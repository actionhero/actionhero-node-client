var net = require('net');
var EventEmitter = require('events').EventEmitter;
var actionhero_client = new EventEmitter;

var defaults = {
	host: "127.0.0.1",
	port: "5000",
	delimiter: "\r\n",
	logLength: 100,
};

actionhero_client.connection = null;
actionhero_client.params = {};
actionhero_client.lastLine = false;
actionhero_client.stream = "";
actionhero_client.log = [];
actionhero_client.messageCount = 0;
actionhero_client.userMessages = {};
actionhero_client.expectedResponses = {};

//////////////////////////////////////////////

actionhero_client.connect = function(p, next){
	actionhero_client.params = p;
	for(var i in defaults){
		if(actionhero_client.params[i] == null){
			actionhero_client.params[i] = defaults[i];
		}
	}

	actionhero_client.connection = net.createConnection(actionhero_client.params.port, actionhero_client.params.host);
	actionhero_client.connection.setEncoding("utf8");

	actionhero_client.connection.on("data", function (chunk){
		actionhero_client.emit('rawData', String(chunk));
		actionhero_client.stream += String(chunk);
		if(actionhero_client.stream.charAt(actionhero_client.stream.length - 1) == "\n" && actionhero_client.stream.charAt(actionhero_client.stream.length - 2) == "\r"){
			try{
				var lines = actionhero_client.stream.split("\r\n");
				for(var i in lines){
					var line = lines[i];
					if(line.length > 0){
						actionhero_client.lastLine = JSON.parse(line);
						actionhero_client.emit('data', actionhero_client.lastLine);
						actionhero_client.addLog(actionhero_client.lastLine, actionhero_client.params);
						actionhero_client.handleData(actionhero_client.lastLine);
					}
				}
				actionhero_client.stream = "";
			}catch(e){
				actionhero_client.lastLine = null;
			}
		}
	});

	actionhero_client.connection.on("error", function(err){
		actionhero_client.emit('error', err);
	});

	actionhero_client.connection.on("end", function (){
		actionhero_client.emit('end', null);
	});

	if(typeof next == "function"){
		next(true, actionhero_client.connection);
	}
}

//////////////////////////////////////////////

actionhero_client.handleData = function(data){
	if(data.messageCount > actionhero_client.messageCount){ 
		actionhero_client.messageCount = data.messageCount; 
	}
	if(data.context == "api"){
		// welcome message; indicates successfull connection
		if(data.welcome != null){
			actionhero_client.emit('connected');
			actionhero_client.emit('welcome', data.welcome);
		}
		// Periodic keep alive message
		else if(data.status == "keep-alive"){
			actionhero_client.emit('keep-alive', data);
		}
	}
	// "say" messages from other users
	else if(data.context == "user"){
		actionhero_client.userMessages[data.from] = {
			timeStamp: new Date(),
			message: data.message,
			from: data.from
		}
		actionhero_client.emit('say', actionhero_client.userMessages[data.from]);
	}
	// responses to your actions
	else if(data.context == "response"){
		if(actionhero_client.expectedResponses[data.messageCount] != null){
			var next = actionhero_client.expectedResponses[data.messageCount]
			next(data);
			delete actionhero_client.expectedResponses[data.messageCount];
		}
	}
	// ?
	else{ }
}

actionhero_client.send = function(str){
	actionhero_client.connection.write(str + "\r\n");
}

actionhero_client.registerResponseAndCall = function(msg, next){
	if(actionhero_client.connection != null){
		actionhero_client.messageCount++;
		var responseID = actionhero_client.messageCount;
		if(typeof next == "function"){
			actionhero_client.expectedResponses[responseID] = next;
		}
		process.nextTick(function(){
			actionhero_client.send(msg);
		});
	}else{
		actionhero_client.emit('error',"Not Connected");
	}
}

//////////////////////////////////////////////

actionhero_client.disconnect = function(next){
	actionhero_client.registerResponseAndCall("exit",next);
}

actionhero_client.paramAdd = function(k,v,next){
	if(k != null){
		actionhero_client.registerResponseAndCall("paramAdd "+k+"="+v,next);
	}else{
		if(typeof next == "function"){ next(false); }
	}
}

actionhero_client.paramDelete = function(k,next){
	actionhero_client.registerResponseAndCall("paramDelete "+k,next);
}

actionhero_client.paramsDelete = function(next){
	actionhero_client.registerResponseAndCall("paramsDelete",next);
}

actionhero_client.paramView = function(k,next){
	actionhero_client.registerResponseAndCall("paramView "+k,next);
}

actionhero_client.paramsView = function(next){
	actionhero_client.registerResponseAndCall("paramsView",next);
}

actionhero_client.roomView = function(next){
	actionhero_client.registerResponseAndCall("roomView",next);
}

actionhero_client.roomChange = function(room,next){
	actionhero_client.registerResponseAndCall("roomChange "+room,next);
}

actionhero_client.say = function(msg,next){
	actionhero_client.registerResponseAndCall("say "+msg,next);
}

actionhero_client.action = function(action,next){
	actionhero_client.registerResponseAndCall(action,next);
}

actionhero_client.actionWithParams = function(action,params,next){
	// I will clear all existing params
	actionhero_client.paramsDelete(function(){
		var started = 0;
		for(var i in params){
			started++;
			actionhero_client.paramAdd(i,params[i],function(){
				started--;
				if(started == 0){
					actionhero_client.action(action, next);
				}
			});
		}
		if(started == 0){
			actionhero_client.action(action, next);
		}
	});
}

//////////////////////////////////////////////

actionhero_client.addLog = function(entry, params){
	actionhero_client.log.push({
		timestamp: new Date(),
		data: entry
	})
	if(actionhero_client.log.length > params.logLength){
		actionhero_client.log.splice(0,1);
	}
}

//////////////////////////////////////////////

exports.actionhero_client = actionhero_client;