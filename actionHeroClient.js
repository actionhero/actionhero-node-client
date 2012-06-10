var net = require('net');
var EventEmitter = require('events').EventEmitter;
var actionHeroClient = new EventEmitter;

var defaults = {
	host: "127.0.0.1",
	port: "5000",
	delimiter: "\r\n",
	logLength: 100,
};

actionHeroClient.connection = null;
actionHeroClient.params = {};
actionHeroClient.lastLine = false;
actionHeroClient.stream = "";
actionHeroClient.log = [];
actionHeroClient.messageCount = 0;
actionHeroClient.userMessages = {};
actionHeroClient.expectedResponses = {};

//////////////////////////////////////////////

actionHeroClient.connect = function(p, next){
	
	for(var i in defaults){
		if(actionHeroClient.params[i] == null){
			actionHeroClient.params[i] = defaults[i];
		}
	}

	actionHeroClient.connection = net.createConnection(actionHeroClient.params.port, actionHeroClient.params.host);
	actionHeroClient.connection.setEncoding("utf8");

	actionHeroClient.connection.on("data", function (chunk){
		actionHeroClient.emit('rawData', String(chunk));
		actionHeroClient.stream += String(chunk);
		if(actionHeroClient.stream.charAt(actionHeroClient.stream.length - 1) == "\n" && actionHeroClient.stream.charAt(actionHeroClient.stream.length - 2) == "\r"){
			try{
				var lines = actionHeroClient.stream.split("\r\n");
				for(var i in lines){
					var line = lines[i];
					if(line.length > 0){
						actionHeroClient.lastLine = JSON.parse(line);
						actionHeroClient.emit('data', actionHeroClient.lastLine);
						actionHeroClient.addLog(actionHeroClient.lastLine, actionHeroClient.params);
						actionHeroClient.handleData(actionHeroClient.lastLine);
					}
				}
				actionHeroClient.stream = "";
			}catch(e){
				actionHeroClient.lastLine = null;
			}
		}
	});

	actionHeroClient.connection.on("error", function(err){
		actionHeroClient.emit('error', err);
	});

	actionHeroClient.connection.on("end", function (){
		actionHeroClient.emit('end', null);
	});

	if(typeof next == "function"){
		next(true, actionHeroClient.connection);
	}
}

//////////////////////////////////////////////

actionHeroClient.handleData = function(data){
	if(data.messageCount > actionHeroClient.messageCount){ 
		actionHeroClient.messageCount = data.messageCount; 
	}
	if(data.context == "api"){
		// welcome message; indicates successfull connection
		if(data.welcome != null){
			actionHeroClient.emit('connected');
			actionHeroClient.emit('welcome', data.welcome);
		}
		// Periodic keep alive message
		else if(data.status == "keep-alive"){
			actionHeroClient.emit('keep-alive', data);
		}
	}
	// "say" messages from other users
	else if(data.context == "user"){
		actionHeroClient.userMessages[data.from] = {
			timeStamp: new Date(),
			message: data.message,
			from: data.from
		}
		actionHeroClient.emit('say', actionHeroClient.userMessages[data.from]);
	}
	// responses to your actions
	else if(data.context == "response"){
		if(actionHeroClient.expectedResponses[data.messageCount] != null){
			var next = actionHeroClient.expectedResponses[data.messageCount]
			next(data);
			delete actionHeroClient.expectedResponses[data.messageCount];
		}
	}
	// ?
	else{ }
}

actionHeroClient.send = function(str){
	actionHeroClient.connection.write(str + "\r\n");
}

actionHeroClient.registerResponseAndCall = function(msg, next){
	if(actionHeroClient.connection != null){
		actionHeroClient.messageCount++;
		var responseID = actionHeroClient.messageCount;
		if(typeof next == "function"){
			actionHeroClient.expectedResponses[responseID] = next;
		}
		process.nextTick(function(){
			actionHeroClient.send(msg);
		});
	}else{
		actionHeroClient.emit('error',"Not Connected");
	}
}

//////////////////////////////////////////////

actionHeroClient.disconnect = function(next){
	actionHeroClient.registerResponseAndCall("exit",next);
}

actionHeroClient.paramAdd = function(k,v,next){
	if(k != null){
		actionHeroClient.registerResponseAndCall("paramAdd "+k+"="+v,next);
	}else{
		if(typeof next == "function"){ next(false); }
	}
}

actionHeroClient.paramDelete = function(k,next){
	actionHeroClient.registerResponseAndCall("paramDelete "+k,next);
}

actionHeroClient.paramsDelete = function(next){
	actionHeroClient.registerResponseAndCall("paramsDelete",next);
}

actionHeroClient.paramView = function(k,next){
	actionHeroClient.registerResponseAndCall("paramView "+k,next);
}

actionHeroClient.paramsView = function(next){
	actionHeroClient.registerResponseAndCall("paramsView",next);
}

actionHeroClient.roomView = function(next){
	actionHeroClient.registerResponseAndCall("roomView",next);
}

actionHeroClient.roomChange = function(room,next){
	actionHeroClient.registerResponseAndCall("roomChange "+room,next);
}

actionHeroClient.say = function(msg,next){
	actionHeroClient.registerResponseAndCall("say "+msg,next);
}

actionHeroClient.action = function(action,next){
	actionHeroClient.registerResponseAndCall(action,next);
}

actionHeroClient.actionWithParams = function(action,params,next){
	// I will clear all existing params
	actionHeroClient.paramsDelete(function(){
		var started = 0;
		for(var i in params){
			started++;
			actionHeroClient.paramAdd(i,params[i],function(){
				started--;
				if(started == 0){
					actionHeroClient.action(action, next);
				}
			});
		}
		if(started == 0){
			actionHeroClient.action(action, next);
		}
	});
}

//////////////////////////////////////////////

actionHeroClient.addLog = function(entry, params){
	actionHeroClient.log.push({
		timestamp: new Date(),
		data: entry
	})
	if(actionHeroClient.log.length > params.logLength){
		actionHeroClient.log.splice(0,1);
	}
}

//////////////////////////////////////////////

exports.actionHeroClient = actionHeroClient;