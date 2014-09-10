var nconf = require("nconf"),
	fs = require("fs");

nconf.argv()
   .env('__');

var localConfigPath = __dirname + "/config-local.json";
if(fs.existsSync(localConfigPath))
	nconf.add('local-config', {type: 'file', file:localConfigPath});

if(process.env.NODE_ENV == "production")
   nconf.add('prod-config', {type: 'file', file: __dirname + "/config-prod.json"});

else if(process.env.NODE_ENV == "dev")
   nconf.add('test-config', {type: 'file', file: __dirname + "/config-dev.json"});


//Default config
nconf.defaults(
{
	//REDIS
	"redis": {
		"host" : "127.0.0.1",
		"port" : "6379",
		"password" : null,
		"prefix" : "NOT_SET"
	},

	//AWS credentials
	"aws":{
		"key"    : "NOT_SET",
		"secret" : "NOT_SET"
	}

});

nconf.getInt = function(key, _default){
	var val = nconf.get(key);
	if(typeof val == "number")
		return Math.floor(val);

	try{
		val = parseInt(val);
		if(isNaN(val))
			return _default;
		else
			return val;
	}catch(err){
		return _default;
	}
};

nconf.getFloat = function(key, _default){
	var val = nconf.get(key);
	if(typeof val == "number")
		return val;

	try{
		val = parseFloat(val);
		if(isNaN(val))
			return _default;
		else
			return val;
	}catch(err){
		return _default;
	}
};

nconf.getBool = function(key, _default){
	var val = nconf.get(key);
	if(val == "true")
		return true;
	if(val == "false")
		return false;

	if(typeof _default == "undefined")
		return false;

	return _default;
};

module.exports = nconf;