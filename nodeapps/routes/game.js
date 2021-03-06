var moniker = require('moniker'),
  config = require('./../config'),
  title = require('to-title-case'),
  redis = require("../lib/redis"),
  _ = require("underscore"),
  async = require("async"),
  SessionSockets = require('session.socket.io'),
  io = null, 
  sock = null, //Web Client sockets
  npm = null,	//Inter-server sockets
  raspiSock = null, //Raspi Socket
  raspiState = null, //Current state of the raspi (OPENING, OPEN, CLOSING, CLOSED)
  power = 0 //Count of Switches turned on
;


//Target total of switches that need to open
var total = config.getInt("target_count", 25);

//Valid Open sequences, stored in redis
var openSequences = ["RANDOM"];
var closeSequences = ["RANDOM"];


init_game();

//Initializes the gamestate (called at end of this file)
function init_game(){
	var d = new Date();
	redis.client.multi([
        ["setnx", "game_state", "running-"+d.getTime()],
        ["setnx", "pi_config", JSON.stringify({openSequences:["RANDOM"],closeSequences:["RANDOM"]})],
        ["get", "pi_config"]
    ]).exec(function (err, results) {
      	if (err){
          	console.error("ERROR init game Redis multi:" + err);
        } else {
        	var piConfig = JSON.parse(results[2]);
        	openSequences = piConfig.openSequences;
        	closeSequences = piConfig.closeSequences;
        }
    });
}

//Resets the game to a starting state
function resetGame(){
	console.log("RESET GAME");
	var d = new Date();
	redis.client.multi([
        ["del", "main_count"],
        ["del", "leaderboard"],
        ["set", "game_state", "running-"+d.getTime()],
        ["incr", "game_num"],
    ]).exec(function (err, results) {
      	if (err){
          	console.error("ERROR reset game Redis multi:" + err);
        }
    });
}


exports.landing = function(req, res){
	if(typeof req.session.handle == "undefined"){
		req.session.handle = title(moniker.choose().replace("-", " "));
	}

  	res.render("landing", {moniker:req.session.handle, openSequences:openSequences});
}




exports.play = function(req, res){
	if(openSequences.indexOf(req.params.open_type) < 0)
		res.send("INVALID OPEN TYPE: |" + req.params.open_type + "|");

	req.session.open_type = req.params.open_type;

    redis.client.multi([
    	["set", "open_type:" +req.session.handle, req.params.open_type],
        ["get", "main_count"],
        ["zscore", "leaderboard", req.session.handle],
        ["zrevrank", "leaderboard", req.session.handle],
        ["zrevrange", "leaderboard", 0, 2, "WITHSCORES"],
        ["zcount", "leaderboard", "-inf", "+inf"]


    ]).exec(function (err, results) {
      	if (err){
          	console.error("Redis multi error:" + err);
          	res.render("play", {moniker:req.session.handle,
  						chosen_open:req.params.open_type,
  						todo:total,
  						total:total,
  						done:0,
  						rank:1,
  						player_count:1,
  						score:0,
  						leaderboard:[]});
      	} else {
      		var main_count = parseInt(results[1]);
      		if(isNaN(main_count))
      			main_count = 0;
      		var score = parseInt(results[2]);
      		if(isNaN(score))
      			score = 0;
      		var player_count = parseInt(results[5]);
      		if(player_count == 0)
      			player_count = 1;
      		var rank = parseInt(results[3]);
      		if(isNaN(rank))
      			rank = player_count;
      		else
      			rank++;
      		var leaderboard =  [];
      		_.each(results[3], function(item, idx){
      			if(idx%2 == 1)
      				return;

      			leaderboard.push({"name":item, "score":results[3][idx+1]});
      		});

      		if(leaderboard.length == 0)
      			leaderboard.push({"name":"Everyone", "score":0});

      		res.render("play", {moniker:req.session.handle,
  						chosen_open:req.params.open_type,
  						todo:total-main_count,
  						total:total,
  						done:main_count,
  						rank:rank,
  						player_count:player_count,
  						score:score,
  						leaderboard:leaderboard});
      	}

  	});

};


exports.initSockets = function(http, sessionStore, cookieParser, sessionStoreKey){

	io = require('socket.io')(http);
	sock = new SessionSockets(io, sessionStore, cookieParser, sessionStoreKey);

	sock.of('web').on('connection', function(err, socket, session){userConnectedHandler(err, sock, socket, session);});

	nrp = redis.nrpClient();

	nrp.on('count_update', countUpdateHandler);

	nrp.on('target_reached', targetReachedHandler);

	nrp.on('pi_config', piConfigUpdateHandler);

	//Update leaderboard
	setInterval(function(){
		redis.client.multi([
        ["get", "main_count"],
        ["zrevrange", "leaderboard", 0, 2, "WITHSCORES"],


	    ]).exec(function (err, results) {
	      	if (err){
	          	console.error("Redis multi error:" + err);
	      	} else {
	      		var main_count = parseInt(results[0]);
	      		if(isNaN(main_count)){
	      			main_count = 0;
	      		}
	      		var leaderboard =  [];
	      		_.each(results[1], function(item, idx){
	      			if(idx%2 == 1)
	      				return;

	      			leaderboard.push({"name":item, "score":results[1][idx+1]});
	      		});
	      		if(leaderboard.length == 0)
	      			leaderboard.push({"name":"Everyone", "score":0})
	      		var generalData = {todo:total-main_count,
	      							total:total,
  									done:main_count,
  									leaderboard:leaderboard};
	      		io.of('web').emit("general_update", generalData);
	      	}

	  	});
	}, 2000);

	exports.initDeviceSockets(io);
};


exports.initDeviceSockets = function(io){
	io.of("raspi").on('connection', function (socket) {
    	raspiSock = socket;

    	raspiSock.on("state_change", stateChangeHandler);

    	raspiSock.on("pi_config", piConfigHandler);

    	//Development Function Only for use with raspi.html
    	raspiSock.on("requesting_stay_open", piRequestStayOpen);

		//Send out score update every 100 milliseconds
		setInterval(function(){
			raspiSock.volatile.emit("power", {level:power, top_level:total});
		},100);
  	});

  	function stateChangeHandler(msg){
  		if(msg.key == config.get("raspi_key")){
  			raspiState = msg.state;
  			console.log("STATE CHANGE:" + raspiState);
  		}
	};

	function piConfigHandler(msg){
		if(msg.key == config.get("raspi_key")
			&& typeof msg.open_animations != "undefined"
			&& msg.open_animations.length > 0
			&& msg.open_animations[0].trim().length > 0
			&& typeof msg.close_animations != "undefined"
			&& msg.close_animations.length > 0
			&& msg.close_animations[0].trim().length > 0){

			nrp.emit("pi_config", msg);

			redis.client.set("pi_config", JSON.stringify({openSequences:msg.open_animations,closeSequences:msg.close_animations}), function(err, result){
				if (err)
		          	console.log("could not set pi_config:" + err);
			});
  		}
	};

	function piRequestStayOpen(msg){
  		if(msg.key == config.get("raspi_key")){
  			var data = {duration:msg.duration, close_animation:msg.close_animation};
  			io.of("raspi").emit("stay_open", data);
  			console.log("SENT stay_open command");
  			console.dir(data);


  		}
	};
}

function userConnectedHandler(err, sessionSock, socket, session){
	console.log('a user connected');
	socket.on('disconnect', userDisconnectedHandler);

	socket.on('action', actionHandler);

	function userDisconnectedHandler(){
   		console.log('user disconnected');
   		clearInterval(rankUpdateInterval);
	};

	function actionHandler(msg){

		 sessionSock.getSession(socket, function (err, session) {
		 	if(err)
		 		return console.log("error getting session from socket: " + err);

	 		if(msg == "clicked_on"){
				increment();
				scoreUser(socket, session.handle, 1);
			} else if(msg == "clicked_off"){
				decrement();
				scoreUser(socket, session.handle, -1);
			}

	    	//console.log("HANDLER: " + session.handle);
	  	});

		//console.dir(arguments);
	};

	var rankUpdateInterval = setInterval(function(){
		 redis.client.multi([
        ["zrevrank", "leaderboard", session.handle],
        ["zcount", "leaderboard", "-inf", "+inf"]

	    ]).exec(function (err, results) {
	      	if (err){
	          	console.log("rank update error:" + err);
	      	} else {

	      		var player_count = parseInt(results[1]);
	      		if(isNaN(player_count)){
	      			player_count = 1;
	      		};
	      		var rank = parseInt(results[0]);
      			if(isNaN(rank))
      				rank = player_count;
      			else
	      			rank++;

	      		var rankData = {rank:rank,
  									player_count:player_count};

	      		socket.volatile.emit("rank_update", rankData);
	      	}
	  	});
	}, 2000);
};


function countUpdateHandler(data){
	io.of('web').emit('count', {count:data.count, todo:total-data.count, total:total});
};


function piConfigUpdateHandler(data){
	openSequences = data.open_animations;
	closeSequences = data.close_animations;
};

function scoreUser(socket, userHandle, value){
	redis.client.zincrby("leaderboard", value, userHandle, function(err, result){
		if(err)
			console.err("Could not update user leaderboard:" + err);
		else{
			if(result < 0 && value < 0){
				redis.client.zincrby("leaderboard", value*-1, userHandle);
				result = 0;
			}
			socket.volatile.emit("score", result);
		}
	});
}

function increment(){
 redis.client.incr("main_count", function(err, result) {
      if (err) {
          console.error("Redis error incrementing count" + err);
      } else {
          sendCountUpdate(result, "incr");
          //io.emit('count', (total-result));
      }
  });
};


function decrement(){
  redis.client.decr("main_count", function(err, result) {
      if (err) {
        console.error("Redis error decrementing count" + err);
      } else {
      	if(result < 0){
      		redis.client.incr("main_count");
      		result = 0;
      	}

        sendCountUpdate(result, "decr");
        //io.emit('count', (total-result));
      }
  });
};

/*
* Called when main_score >= total score, usually when increment is called after user action on the front end
*	Records game state and detects f the main_count is still beyond the threshold
*/
function endOfGameReached(){

	console.log("END OF GAME REACHED");
	async.waterfall([
		//STEP 1: Get game state
		function(done){
			redis.client.get("game_state", function(err, state){
				if(err)
					return done("ERROR: error reading game state when end of game reached.", null);
				done(null, {game_state:state});
			});
		},

		//STEP 2: Ensure  Main Count is still passed threshold (helping to protect against race conditions)
		function(data, done){
			redis.client.get("main_count", function(err, main_count){
				if(err)
					return done("ERROR: error reading main count when end of game reached.", null);
				data.isStillEndOfGame = false;
				if(main_count >= total){
					data.isStillEndOfGame = true;
				}
				done(null, data);
			});
		},

		//STEP 3: Alert to game over
		function(data, done){
			if(!data.isStillEndOfGame)
				done(null, data);

			nrp.emit('target_reached', { game_state:data.game_state});
			done(null, data);
		}
	], function(err, data){
		if(err)
			console.log("Error with endofgamereached: " + err);
	});
};


/*
*	Called after endOfGameReached
*		Handles end of game functionality
*/
function targetReachedHandler(params){

	console.log("TARGET REACHED");
	async.waterfall([
		//STEP 1: SET FLAG THAT end game is being handled
		function(done){
			redis.client.set(
	          "end_game_processing",
	          "true",
	          "NX",		//Only set if it's not set
	          "EX",	//Expire
	          "5", //seconds
	          function(err, result){
	            if(err)
	                return done("Could not set flag to handle end of game:" + err, null);

	            var data = {canProcessEndGame:result != null};
	            done(null, data);

	          }
	        );
		},

		//STEP 2: Read Game State
		function(data, done){
			if(!data.canProcessEndGame)
				return done(null, data);

			redis.client.get("game_state", function(err, game_state){
				if(err)
					return done("ERROR: error reading game state in target reached handler", null);
				//If the game states are not the same, then we are catching a race condition and
				//	this game was already handled
				if(game_state != params.game_state)
					data.canProcessEndGame = false;

				done(null, data);
			});
		},

		//STEP 3: Rename leaderboard, get winner + score
		function(data, done){
			if(!data.canProcessEndGame)
				return done(null, data);

			 redis.client.multi([
			  	["zrevrange", "leaderboard", "0", "3", "WITHSCORES"],
		        ["rename", "leaderboard", "last_leaderboard"],

			    ]).exec(function (err, results) {
			      	if (err){
			          	console.log("could not rename leaderboard:" + err);
			          	done("could not rename leaderboard:" + err, data);
			      	} else {
			      		var leaderboard =  [];
			      		_.each(results[0], function(item, idx){
			      			if(idx%2 == 1)
			      				return;

			      			leaderboard.push({"name":item, "score":results[0][idx+1]});
			      		});

			      		if(leaderboard.length == 0)
			      			leaderboard.push({"name":"Everyone", "score":total});

			      		data.winner_handle = leaderboard[0].name;
			      		data.winner_score = leaderboard[0].score;
			      		data.leaderboard = leaderboard;
			      		done(null, data);
			      	}
			  	});
		},

		//STEP 4: Get winner's open type
		function(data, done){

			if(!data.canProcessEndGame)
				return done(null, data);

			redis.client.get("open_type:" +data.winner_handle, function(err, result){
				if (err){
		          	console.log("could not get winner's open type:" + err);
		          	done("could not get winner's open type:" + err, data);
		      	} else {

		      		if(result == null)
		      			data.winner_opentype = openSequences[0];
		      		else
		      			data.winner_opentype = result;
		      		done(null, data);
		      	}
			});
		},

		//STEP 5: Record winner, open type, score
		function(data, done){
			if(!data.canProcessEndGame)
				return done(null, data);

			redis.client.set("winner_info", {handle:data.winner_handle,score:data.winner_score,open_type:data.open_type}, function(err, result){
				if (err){
		          	console.log("could not set winner info:" + err);
		          	done("could not set winner info:" + err, data);
		      	} else {
		      		done(null, data);
		      	}
			});
		},

		//STEP 6: Record
		function(data, done){

			if(!data.canProcessEndGame){
				console.dir(data);
				return done(null, data);
			}


			io.of('web').emit("game_over", {leaderboard:data.leaderboard,
									winner_opentype:data.winner_opentype,
									winner_handle:data.winner_handle,
									winner_score:data.winner_score});
			raspiSock.emit("animation", {open_animation:data.winner_opentype, duration:60*5, close_animation:"RANDOM"});
			done(null, data);
		},

		//STEP 7: Call device if redis block is not present
		function(data, done){
			if(!data.canProcessEndGame)
				return done(null, data);

			redis.client.set(
	          "device_sent_message",
	          "true",
	          "NX",		//Only set if it's not set
	          "EX",	//Expire
	          "1", //seconds
	          function(err, result){
	            if(err)
	                console.log("could not talk with device");

	            if(result != null)
	            	io.of('web').emit("open_spiral", {open_type:data.winner_opentype});

	            done(null, data);
	          }
	        );
		},

		//STEP 8: Reset Game
		function(data, done){
			resetGame();
			done(null, data);
		}

	], function(err, data){
		if(err)
			console.log("Error with endofgamereached: " + err);
	});
}

function sendCountUpdate(count, action){

  if(action == "incr" && parseInt(count) >= total)
  	endOfGameReached();
  power = count;
  nrp.emit('count_update', { count:count, action:action});
};