var vows = require('vows');
var assert = require('assert');
var suite = vows.describe('actionHero Client');

var api = null;

var action_hero_client = require("./actionhero_client.js");
var A = new action_hero_client;

var connectionParams = {
	host: "0.0.0.0",
	port: "5678",
  timeout: 1000,
};

// Create an actionHero server on testing ports
var startServer = function(next){
	var actionHeroPrototype = require("actionHero").actionHeroPrototype;
  var actionHero = new actionHeroPrototype();
	var params = {};
	params.configChanges = {
		general: {
			workers: 1
		},
		log: {
			logging: false,
		},
		httpServer: {
      enable: false,
    },
    tcpServer: {
      enable: true,
      secure: false,
      port: 5678
    },
		webSockets: {
			enable: false
		},
		redis : {
			enable: false,
		}
	}
	actionHero.start(params, function(err, api){
		console.log("Boot Sucessful!");
		next(null, api);
	});
}

// test it! 
suite.addBatch({
  "I should be able to start an actionHero Server": {
    topic: function(){
    	var cb = this.callback
    	startServer(function(err, server_api){
    		api = server_api;
    		cb(true, api)
    	});
    },
    'I got the API object' : function(res, api){ 
    	assert.isObject(api); 
    }
  }
});

suite.addBatch({
  "The client should be able to connect": {
    topic: function(){
    	var cb = this.callback
    	A.on("connected", function(){
    		cb(true, "connected")
    	});
    	A.connect(connectionParams);
    },
    'connected?' : function(res, msg){ 
    	assert.strictEqual(msg, "connected"); 
    }
  }
});

suite.addBatch({
  "I can get my connection details": {
    topic: function(){
      var cb = this.callback;
      A.details(function(err, details, delta){
        cb(err, details, delta)
      })
    },
    'details?' : function(res, details, delta){ 
      assert.strictEqual(details.status, "OK");
      assert.isObject(details.details.public);
      assert.strictEqual(delta >= 0, true);
      assert.strictEqual(delta < 1000, true);
    }
  }
});

suite.addBatch({
  "Server messages should be logged": {
    topic: function(){
    	var cb = this.callback;
    	cb(true, A.log);
    },
    'log?' : function(res, log){ 
    	var str = log[0].data.welcome;
    	assert.strictEqual(str, "Hello! Welcome to the actionHero api"); 
    }
  }
});

suite.addBatch({
  "I should be in a chat room": {
    topic: function(){
    	var cb = this.callback;
    	A.roomView(function(err, msg){
    		cb(err, msg)
    	})
    },
    'roomStatus?' : function(res, msg){ 
    	assert.strictEqual(msg.room, "defaultRoom"); 	
    }
  }
});

suite.addBatch({
  "I can set and view params": {
    topic: function(){
    	var cb = this.callback;
    	A.paramAdd("key", "value", function(err, msg){
    		A.paramsView(function(err, params){
    			cb(err, params)
    		});
    	})
    },
    'params?' : function(res, params){ 
    	assert.strictEqual(params.params.key, "value");
    }
  }
});

suite.addBatch({
  "I can delete (and confirm gone) params": {
    topic: function(){
    	var cb = this.callback;
    	A.paramsDelete(function(err, msg){
    		A.paramsView(function(err, params){
    			cb(err, params)
    		});
    	})
    },
    'no params?' : function(res, params){ 
    	assert.strictEqual(params.params.key, undefined);
    }
  }
});

suite.addBatch({
  "I can run an action (simple)": {
    topic: function(){
    	var cb = this.callback;
		A.action("status", function(err, apiResposne){
			cb(err, apiResposne)
		});
       },
    'resp (simple)?' : function(res, apiResposne){ 
    	assert.isObject(apiResposne);
    	assert.strictEqual(apiResposne.stats.uptimeSeconds > 0, true);
    	assert.strictEqual(apiResposne.stats.socketServer.numberOfLocalActiveSocketClients == 1, true);
    }
  }
});

suite.addBatch({
  "I can run an action (complex)": {
    topic: function(){
    	var cb = this.callback;
		  params = { key: "mykey", value: "myValue" };
		  A.actionWithParams("cacheTest", params, function(err, apiResposne){
			 cb(err, apiResposne)
		  });
    },
    'resp (complex)?' : function(res, apiResposne){ 
    	assert.isObject(apiResposne);
    	assert.strictEqual(apiResposne.cacheTestResults.loadResp.value, "myValue");
    }
  }
});

suite.addBatch({
  "I get events for say": {
    topic: function(){
    	var cb = this.callback;
    	var used = false;
    	A.on("say",function(msgBlock){
    		if(used == false){
				cb(true, msgBlock);
			}
			used = true;
		});
		api.chatRoom.socketRoomBroadcast(api, null, "TEST MESSAGE");
       },
    'resp (complex)?' : function(res, msgBlock){ 
    	assert.isObject(msgBlock);
    	assert.strictEqual(msgBlock.message, "TEST MESSAGE");
    	assert.strictEqual(msgBlock.from, 0); // default from ID
    }
  }
});

suite.addBatch({
  "Timeouts will respond properly": {
    topic: function(){
      var cb = this.callback;
      api.actions['slowAction'] = {
        name: "slowAction",
        description: "I am slow",
        inputs: { required: [], optional: [] },
        outputExample: { },
        run:function(api, connection, next){
          setTimeout(function(){
            next(connection, true);
          },10000)
        }
      }
      A.action("slowAction", function(err, apiResposne, delta){
       cb(err, "SHOLD NOT GET HERE");
      });
      A.on('timeout', function(err, request, caller){
        cb(null, err, request, caller)
      });
    },
    'resp (complex)?' : function(res, err, request, caller){ 
      assert.strictEqual(String(err), "Error: Timeout reached");
      assert.strictEqual(request, "slowAction");
    }
  }
});


// export
suite.export(module);