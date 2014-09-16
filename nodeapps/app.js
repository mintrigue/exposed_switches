var express = require('express')
  app = express(),
  http = require('http').createServer(app),
  redis = require("./lib/redis"),
  swig = require('swig'),
  moniker = require('moniker'),
  config = require('./config'),
  title = require('to-title-case'),
  session = require('express-session'),
  RedisStore = require("connect-redis")(session),
  gameRoute = require("./routes/game"),
  cookieParser = require('cookie-parser')
;

//var AWS = require('aws-sdk');
//AWS.config.update({accessKeyId: config.get("aws:key"), secretAccessKey: config.get("aws:secret")});
//AWS.config.update({region: 'us-east-1'});
//var sns = new AWS.SNS();

var total = 5;

app.engine('html', swig.renderFile);
if(process.env.NODE_ENV == "dev" || process.env.NODE_ENV == "test"){
  swig.setDefaults({ cache: false });
}

var cookieParserInstance = cookieParser(config.get("cookie_secret_key"));
var sessionStoreInstance = new RedisStore({ client: redis.client, prefix:redis.prefix+"sess:"})
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(cookieParserInstance);
app.use(session({secret: config.get("cookie_secret_key")
              , key: config.get("session_cookie_prefix")+"sid"
              , cookie : config.get("session_cookie_domain") == null  ? {} : {domain:config.get("session_cookie_domain")} 
                            , store: sessionStoreInstance
}));



app.get('/', gameRoute.landing);
app.get('/play/:open_type', gameRoute.play);

gameRoute.initSockets(http, sessionStoreInstance, cookieParserInstance, config.get("session_cookie_prefix")+"sid");

  /*
  function(req, res){
  handle = title(moniker.choose().replace("-", " "));

  res.render("play", {moniker:handle, chosen_open:"NINJAS"});
});
*/

app.get('/reset', function(req, res){
  redis.client.set("main_count", 0, function(err, result){
    if(err)
      res.send("Err:" + err);
    else
      res.send("reset");
  });
});
/*
io.on('connection', function(socket){
  console.log('a user connected');

  socket.broadcast.emit('hi');

  socket.on('disconnect', function(){
    console.log('user disconnected');
  });

   socket.on('action', function(msg){
    if(msg == "clicked_on"){
      increment();
      //io.emit('count', togo + "/" + total);

      //if(todo == 0)
        //io.emit('complete', togo + "/" + total);
    } else if(msg == "clicked_off"){
      decrement();
    }
  });
});
*/

/*
function increment(){
 redis.client.incr("main_count", function(err, result) {
      if (err) {
          console.error("Redis error incrementing count" + err);
      } else {
          sendCountUpdate((total-result), "incr");
          //io.emit('count', (total-result));
      }
  });
}


function decrement(){
  redis.client.decr("main_count", function(err, result) {
      if (err) {
        console.error("Redis error decrementing count" + err);
      } else {
        sendCountUpdate((total-result), "decr");
        //io.emit('count', (total-result));
      }
  });
}
*/
/*****
Subscribe
*/
 // subscribe
/*
var nrp = redis.nrpClient();

nrp.on('count_msg', function (data) {
  console.log("UPDATED");
   io.emit('count', data.count);
});
*/

/****
End subscribe
*/
/*
function sendCountUpdate(count, action){
  console.log("UPDATING");
  nrp.emit('count_msg', { count:count, action:action});
}
*/

http.listen(process.env.PORT || 3000, function(){
  console.log('listening on *:3000');
});
