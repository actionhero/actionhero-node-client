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
  timeout: 5000,
  reconnectTimeout: 1000,
  reconnectAttempts: 10,
};

actionheroClient = function(){ 
  EventEmitter.call(this);
  this.connected = false;
  this.connection = null;
  this.params = {};
  this.details = null;
  this.connectCallback = null;
  this.lastLine = null;
  this.stream = "";
  this.log = [];
  this.reconnectAttempts = 0;
  this.messageCount = 0;
  this.userMessages = {};
  this.expectedResponses = {};
  this.startingTimeStamps = {};
  this.responseTimesouts = {};
  this.defaults = Defaults;
};

util.inherits(actionheroClient, EventEmitter);

actionheroClient.prototype.connect = function(params, next){
  var self = this;

  if(self.connection){ delete self.connection; }

  if(params){ self.params = params; }
  if(typeof next == 'function'){
    self.connectCallback = next;
  }

  for(var i in self.defaults){
    if(self.params[i] === null || self.params[i] === undefined){
      self.params[i] = self.defaults[i];
    }
  }

  if(self.params.secure === true){
    self.connection = tls.connect(self.params.port, self.params.host);
  }else{
    self.connection = net.connect(self.params.port, self.params.host);
  }
  self.connection.setEncoding("utf8");

  self.connection.on("data", function (chunk){
    self.emit('rawData', String(chunk));
    self.stream += String(chunk);
    var delimited = false;
    if(self.stream.indexOf(self.params.delimiter) >= 0){
      delimited = true;
    }

    if(delimited === true){
      try{
        var lines = self.stream.split(self.params.delimiter);
        for(var j in lines){
          var line = lines[j];
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

  self.connection.on("connect", function(err){
    self.connected = true;
    self.messageCount = 0;
    self.reconnectAttempts = 0;
    self.detailsView(function(){
      self.emit('connected');
      if(typeof self.connectCallback === 'function'){
        self.connectCallback(null, self.lastLine.welcome);
        delete self.connectCallback;
      }
    });
  });

  self.connection.on("error", function(err){
    self.emit('error', err);
    self.reconnect();
  });

  self.connection.on("end", function (){
    if(self.connected !== null){ self.connected = false; }
    self.emit('end', null);
    self.connection.removeAllListeners('data');
    self.connection.removeAllListeners('error');
    self.connection.removeAllListeners('end');
    self.reconnect();
  });
};

actionheroClient.prototype.reconnect = function(){
  var self = this;

  self.reconnectAttempts++;
  if(self.reconnectAttempts > self.params.reconnectAttempts){
    self.emit('error', new Error('maximim reconnectAttempts reached'));
  }else if(self.connected === false && self.params.reconnectTimeout && self.params.reconnectTimeout > 0){
    setTimeout(function(){
      self.connect();
    }.bind(self), self.params.reconnectTimeout);
  }
};

actionheroClient.prototype.disconnect = function(next){
  var self = this;
  self.connected = null;

  process.nextTick(function(){
    self.send('exit');
    if(typeof next === 'function'){
      next();
    }
  });
};

actionheroClient.prototype.handleData = function(data){
  try{
    this.lastLine = JSON.parse(data);
  }catch(e){
    this.emit('error', e, data);
  }
  
  this.emit('data', this.lastLine);
  this.addLog(this.lastLine);

  if(this.lastLine.messageCount && this.lastLine.messageCount > this.messageCount){ 
    this.messageCount = this.lastLine.messageCount; 
  }
  if(this.lastLine.context == "api" && this.lastLine.welcome){
    // welcome message; indicates successfull connection
    this.emit('welcome', this.lastLine.welcome);
  }
  // "say" messages from other users
  else if(this.lastLine.context == "user"){
    this.userMessages[this.lastLine.from] = {
      timeStamp: new Date(),
      message: this.lastLine.message,
      from: this.lastLine.from
    };
    this.emit('say', this.userMessages[this.lastLine.from]);
  }
  // responses to your actions
  else if(this.lastLine.context == "response"){
    if(this.expectedResponses[this.lastLine.messageCount]){
      clearTimeout(this.responseTimesouts[this.lastLine.messageCount]);
      var next = this.expectedResponses[this.lastLine.messageCount];
      var delta = new Date().getTime() - this.startingTimeStamps[this.lastLine.messageCount];
      delete this.expectedResponses[this.lastLine.messageCount];
      delete this.startingTimeStamps[this.lastLine.messageCount];
      delete this.responseTimesouts[this.lastLine.messageCount];

      var error = null;
      if(this.lastLine.error){
        error = new Error(this.lastLine.error);
      }else if(this.lastLine.status && this.lastLine.status != 'OK'){
        error = new Error(this.lastLine.status);
      }

      next(error, this.lastLine, delta);
    }
  }
  // ?
  else{ }
};

actionheroClient.prototype.send = function(str){
  this.connection.write(str + "\r\n");
};

actionheroClient.prototype.registerResponseAndCall = function(msg, next){
  var self = this;
  if(self.connection){
    self.messageCount++;
    var responseID = self.messageCount;
    if(typeof next == "function"){
      self.expectedResponses[responseID] = next;
      self.startingTimeStamps[responseID] = new Date().getTime();
      self.responseTimesouts[responseID] = setTimeout(
        function(msg, next){
          var error = new Error("Timeout reached");
          self.emit('timeout', error, msg, next);
          next(error);
          delete self.startingTimeStamps[responseID];
          delete self.expectedResponses[responseID];
        }, 
      self.params.timeout, msg, next);
    }
    process.nextTick(function(){
      self.send(msg);
    });
  }else{
    self.emit('error',new Error("Not Connected"));
  }
};

actionheroClient.prototype.documentation = function(next){
  this.registerResponseAndCall("documentation", next);
};

actionheroClient.prototype.paramAdd = function(k, v, next){
  if(k !== null && v !== null){
    this.registerResponseAndCall("paramAdd "+k+"="+v, next);
  }else{
    if(typeof next == "function"){ next(new Error("key and value are required"), null); }
  }
};

actionheroClient.prototype.paramDelete = function(k, next){
  if(k !== null){
    this.registerResponseAndCall("paramDelete "+k, next);
  }else{
    if(typeof next == "function"){ next(new Error("key is required"), null); }
  }
};

actionheroClient.prototype.paramsDelete = function(next){
  this.registerResponseAndCall("paramsDelete", next);
};

actionheroClient.prototype.paramView = function(k, next){
  this.registerResponseAndCall("paramView "+k, next);
};

actionheroClient.prototype.paramsView = function(next){
  this.registerResponseAndCall("paramsView", next);
};

actionheroClient.prototype.roomView = function(room, next){
  this.registerResponseAndCall("roomView " + room, next);
};

actionheroClient.prototype.detailsView = function(next){
  var self = this;
  self.registerResponseAndCall('detailsView', function(err, data, delta){
    if(!err){ 
      self.details = data.data; 
      self.id      = data.data.id; 
    }
    next(err, data, delta);
  });
};

actionheroClient.prototype.roomAdd = function(room, next){
  this.registerResponseAndCall('roomAdd ' + room, next);
};

actionheroClient.prototype.roomLeave = function(room, next){
  this.registerResponseAndCall('roomLeave ' + room, next);
};

actionheroClient.prototype.say = function(room, msg, next){
  this.registerResponseAndCall('say '+ room + ' ' + msg, next);
};

actionheroClient.prototype.action = function(action, next){
  this.registerResponseAndCall(action, next);
};

actionheroClient.prototype.file = function(file, next){
  this.registerResponseAndCall('file ' + file, next);
};

actionheroClient.prototype.actionWithParams = function(action, params, next){
  var msg = {
    action: action,
    params: params,
  };

  this.registerResponseAndCall(JSON.stringify(msg), next);
};

actionheroClient.prototype.addLog = function(entry){
  this.log.push({
    timestamp: new Date(),
    data: entry
  });
  if(this.log.length > this.params.logLength){
    this.log.splice(0,1);
  }
};

module.exports = actionheroClient;