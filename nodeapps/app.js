var express = require('express')
  app = express(),
  http = require('http').Server(app),
  io = require('socket.io')(http),
  redis = require("./lib/redis"),
  swig = require('swig'),
  moniker = require('moniker'),
  config = require('./config')
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
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res){
  res.render("index", {moniker:moniker.choose()});
});

app.get('/reset', function(req, res){
  redis.client.set("main_count", 0, function(err, result){
    if(err)
      res.send("Err:" + err);
    else
      res.send("reset");
  });
});

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
/*****
Subscribe
*/
 // subscribe
var nrp = redis.nrpClient();

nrp.on('count_msg', function (data) {
  console.log("UPDATED");
   io.emit('count', data.count);
});


/****
End subscribe
*/

function sendCountUpdate(count, action){
  console.log("UPDATING");
  nrp.emit('count_msg', { count:count, action:action});
}

http.listen(3000, function(){
  console.log('listening on *:3000');
});