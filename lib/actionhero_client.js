var net = require('net');
var tls = require('tls');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Defaults = {
  host: "127.0.0.1",
  port: "5000",
  delimiter: "\r\n",
  logLength: 100,
  secure: false,
  timeout: 3000,
};

actionhero_client = function(){ 
  EventEmitter.call(this);
  this.connection = null;
  this.params = {};
  this.connectCallback = null;
  this.lastLine = null;
  this.stream = "";
  this.log = [];
  this.messageCount = 0;
  this.userMessages = {};
  this.expectedResponses = {};
  this.startingTimeStamps = {};
  this.responseTimesouts = {};
  this.defaults = Defaults;
}

util.inherits(actionhero_client, EventEmitter);

//////////////////////////////////////////////

actionhero_client.prototype.connect = function(p, next){
  var self = this;

  self.params = p;
  if(typeof next == 'function'){
    self.connectCallback = next;
  }

  for(var i in self.defaults){
    if(self.params[i] == null){
      self.params[i] = self.defaults[i];
    }
  }

  if(self.params.secure == true){
    self.connection = tls.connect(self.params.port, self.params.host);
  }else{
    self.connection = net.connect(self.params.port, self.params.host);
  }
  self.connection.setEncoding("utf8");

  self.connection.on("data", function (chunk){
    self.emit('rawData', String(chunk));
    self.stream += String(chunk);
    var delimited = true;
    for(var i in self.delimiter){
      var char = self.delimiter[i];
      if(self.stream.charAt(self.stream.length - (i + 1)) != char){
        delimited = false;
        break;
      }
    }
    if(delimited == true){
      try{
        var lines = self.stream.split(self.delimiter);
        for(var i in lines){
          var line = lines[i];
          if(line.length > 0){
            self.handleData(line);
          }
        }
        self.stream = "";
      }catch(e){
        self.lastLine = null;
      }
    }
  });

  self.connection.on("error", function(err){
    self.emit('error', err);
  });

  self.connection.on("end", function (){
    self.emit('end', null);
  });

}

//////////////////////////////////////////////

actionhero_client.prototype.handleData = function(data){

  this.lastLine = JSON.parse(data);
  this.emit('data', this.lastLine);
  this.addLog(this.lastLine);

  if(this.lastLine.messageCount > this.messageCount){ 
    this.messageCount = this.lastLine.messageCount; 
  }
  if(this.lastLine.context == "api"){
    // welcome message; indicates successfull connection
    if(this.lastLine.welcome != null){
      this.emit('connected');
      this.emit('welcome', this.lastLine.welcome);
      if(this.connectCallback != null){
        this.connectCallback(null, this.lastLine.welcome);
      }
    }
  }
  // "say" messages from other users
  else if(this.lastLine.context == "user"){
    this.userMessages[this.lastLine.from] = {
      timeStamp: new Date(),
      message: this.lastLine.message,
      from: this.lastLine.from
    }
    this.emit('say', this.userMessages[this.lastLine.from]);
  }
  // responses to your actions
  else if(this.lastLine.context == "response"){
    if(this.expectedResponses[this.lastLine.messageCount] != null){
      clearTimeout(this.responseTimesouts[this.lastLine.messageCount]);
      var next = this.expectedResponses[this.lastLine.messageCount];
      var delta = new Date().getTime() - this.startingTimeStamps[this.lastLine.messageCount];
      delete this.expectedResponses[this.lastLine.messageCount];
      delete this.startingTimeStamps[this.lastLine.messageCount];
      delete this.responseTimesouts[this.lastLine.messageCount];
      next(null, this.lastLine, delta);
    }
  }
  // ?
  else{ }
}

actionhero_client.prototype.send = function(str){
  this.connection.write(str + "\r\n");
}

actionhero_client.prototype.registerResponseAndCall = function(msg, next){
  var self = this;
  if(self.connection != null){
    self.messageCount++;
    var responseID = self.messageCount;
    if(typeof next == "function"){
      self.expectedResponses[responseID] = next;
      self.startingTimeStamps[responseID] = new Date().getTime();
      self.responseTimesouts[responseID] = setTimeout(
        function(msg, next){
          self.emit('timeout', new Error("Timeout reached"), msg, next);
        }, 
      self.params.timeout, msg, next);
    }
    process.nextTick(function(){
      self.send(msg);
    });
  }else{
    self.emit('error',new Error("Not Connected"));
  }
}

//////////////////////////////////////////////

actionhero_client.prototype.disconnect = function(next){
  this.registerResponseAndCall("exit",next);
}

actionhero_client.prototype.paramAdd = function(k,v,next){
  if(k != null && v != null){
    this.registerResponseAndCall("paramAdd "+k+"="+v,next);
  }else{
    if(typeof next == "function"){ next(new Error("key and value are required"), null); }
  }
}

actionhero_client.prototype.paramDelete = function(k,next){
  if(k != null){
    this.registerResponseAndCall("paramDelete "+k,next);
  }else{
    if(typeof next == "function"){ next(new Error("key is required"), null); }
  }
}

actionhero_client.prototype.paramsDelete = function(next){
  this.registerResponseAndCall("paramsDelete",next);
}

actionhero_client.prototype.paramView = function(k,next){
  this.registerResponseAndCall("paramView "+k,next);
}

actionhero_client.prototype.paramsView = function(next){
  this.registerResponseAndCall("paramsView",next);
}

actionhero_client.prototype.roomView = function(next){
  this.registerResponseAndCall("roomView",next);
}

actionhero_client.prototype.details = function(next){
  this.registerResponseAndCall("detailsView",next);
}

actionhero_client.prototype.roomChange = function(room,next){
  this.registerResponseAndCall("roomChange "+room,next);
}

actionhero_client.prototype.roomLeave = function(room,next){
  this.registerResponseAndCall("roomLeave "+room,next);
}

actionhero_client.prototype.listenToRoom = function(room,next){
  this.registerResponseAndCall("listenToRoom "+room,next);
}

actionhero_client.prototype.silenceRoom = function(room,next){
  this.registerResponseAndCall("silenceRoom "+room,next);
}

actionhero_client.prototype.say = function(msg,next){
  this.registerResponseAndCall("say "+msg,next);
}

actionhero_client.prototype.action = function(action,next){
  this.registerResponseAndCall(action,next);
}

actionhero_client.prototype.actionWithParams = function(action,params,next){
    var msg = {
      action: action,
      params: params,
    };
    this.registerResponseAndCall(JSON.stringify(msg), next);
}

//////////////////////////////////////////////

actionhero_client.prototype.addLog = function(entry){
  this.log.push({
    timestamp: new Date(),
    data: entry
  })
  if(this.log.length > this.params.logLength){
    this.log.splice(0,1);
  }
}

//////////////////////////////////////////////

module.exports = actionhero_client;