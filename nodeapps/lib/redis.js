/*
* Redis cache 
*
*	Note: get will return null if value is not set
*/

var config = require("../config")
	,redis = require("redis")
	,NRP = require('node-redis-pubsub')
	,client = null
	,prefix = null
	,nrp = null
;

//Set options
var options = {no_ready_check:true};
var pw = config.get("redis:password");
if(typeof pw == "string" && pw.length > 0)
	options.auth_pass = pw;



exports.client = client = redis.createClient(config.get("redis:port"),config.get("redis:host"), options);

exports.prefix = prefix = config.get("redis:prefix")+":";


/*
*  A lock using redis
*/
exports.getLock = function(name, seconds, callback){
	var id = Math.random()+"";
	client.SET(prefix + name, id, "NX", "EX", seconds, function(err, result){
		if(err)
			return callback(err, null);

		if(result == "OK")
			callback(err, new LockObj(prefix+name, id));
		else
			callback(null, null);
	});
}

exports.nrpClient = function(){
	if(nrp == null){
		var cfg = { port: config.get("redis:port")       // Port of your remote Redis server
             , host: config.get("redis:host") // Redis server host, defaults to 127.0.0.1
             , password: config.get("redis:password") // Password 
             , scope: process.env.NODE_ENV    // Use a scope to prevent two NRPs from sharing messages
             };
        nrp = new NRP(cfg);
	};

	return nrp;
}
/*
* Lock object allows a lock to be deleted later
*/
function LockObj(name, id){
	this.name = name;
	this.id = id;
}

LockObj.prototype.delete = function(){
	var self = this;
	
	client.eval(
				'if redis.call("get",KEYS[1]) == ARGV[1] '+
				'then ' +				
				'    return redis.call("del",KEYS[1]) '+
				'else '+
				'    return 0  '+
				'end',
				1,								
				this.name,
				this.id,
				function(err, val){
					if(err)
						console.log("ERROR: redis lockobj could not delete " + this.name + ":" + err);	
				}
	);
}

client.on("error", function (err) {
   console.error("Redis Error " + err);
});
