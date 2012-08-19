#actionHeroClient (for nodeJS)

[![Endorse Me](http://api.coderwall.com/evantahler/endorsecount.png)](http://coderwall.com/evantahler)

This library makes it easy for one nodeJS process to talk to a remote [actionHero](http://actionherojs.com/) server.

This library makes use of actionHero's TCP socket connections to enable fast, stateful connections.  This library also allows for many concurrent and asynchronous requests to be running in parallel by making use of actionHero's message counter.  This library is at times event-driven, and for functions that makes sense to do so, callback based.

## Setup

Installation should be as simple as:

	npm install actionhero_client

and then you can include it in your projects with:

	var actionHeroClient = require("actionHeroClient").actionHeroClient;

Once you have included the actionHeroClient library within your project, you can connect like this:

	actionHeroClient.connect({
		host: "127.0.0.1",
		port: "5000",
	});

## Events

actionHeroClient will emit a few types of events (many of which are caught in the example below).  Here are the events, and how you might catch them:

* `actionHeroClient.on("connected", function(null){})`
* `actionHeroClient.on("end", function(null){})`
* `actionHeroClient.on("welcome", function(welcomeMessage){})`
  * welcomeMessage is a string
* `actionHeroClient.on("error", function(errorMessage){})`
  * errorMessage is a string
* `actionHeroClient.on("say", function(messageBlock){})`
  * messageBlock is a hash containing `timeStamp`, `from`, and `message`
* `actionHeroClient.on("keep-alive", function(null){})`
  * this event will be fired from the server periodically when a keep-alive packet is sent.
* `actionHeroClient.on("data", function(null){})`
  * data is a hash {} containing all the data sent back from the server
* `actionHeroClient.on("rawData", function(null){})`
  * rawData is every line/message sent back from the server before concatenation or JSON parsing.  This might be useful for binary / file transfers

## Methods

One you are connected (by waiting for the "connected" event), the following methods will be available to you:

* `actionHeroClient.disconnect(next)`
* `actionHeroClient.paramAdd(key,value,next)`
  * remember that both key and value must pass JSON.stringify
* `actionHeroClient.paramDelete(key,next)`
* `actionHeroClient.paramsDelete(next)`
* `actionHeroClient.paramView(key,next)`
* `actionHeroClient.paramsView(next)`
* `actionHeroClient.roomView(next)`
* `actionHeroClient.roomChange(room,next)`
* `actionHeroClient.say(msg,next)`
* `actionHeroClient.action(action,next)`
  * this basic action method will not set or unset any params  
* `actionHeroClient.actionWithParams(action,params,next)`
  * this action will clear any previously set params to the connection
  * params is a hash of this form `{key: "myKey", value: "myValue"}` 

Each callback will receive the full data hash returned from the server


## Data 

There are a few data elements you can inspect on `actionHeroClient`:

* `actionHeroClient.lastLine`
  * This is the last parsed JSON message received from the server (chronologically, not by messageID)
* `actionHeroClient.userMessages`
  * a hash which contains the latest `say` message from all users
* `actionHeroClient.log`
  * An array of the last n parsable JSON replies from the server
  * each entry is of the form {data, timeStamp} where data was the server's full response
* `actionHeroClient.messageCount` 
  * An integer counting the number of messages received from the server

## Example

	var A = require("./actionHeroClient.js").actionHeroClient;
	
	A.connect({
		host: "127.0.0.1",
		port: "5000",
	});
	
	A.on("say",function(msgBlock){
		console.log(" > SAY: " + msgBlock.message + " | from: " + msgBlock.from);
	});
	
	A.on("welcome", function(msg){
		console.log("WELCOME: " + msg);
	});
	
	A.on("error", function(err){
		console.log("ERROR: " + err);
	});
	
	A.on("keep-alive", function(){
		console.log("KEEP-ALIVE recived");
	});
	
	A.on("end", function(){
		console.log("Connection Closed");
	});
	
	A.on("connected", function(){
		console.log("\r\nCONNECTED\r\n");
		A.action("status", function(apiResposne){
			console.log("STATUS:");
			console.log(" > uptimeSeconds: " + apiResposne.stats.uptimeSeconds);
			console.log(" > numberOfLocalSocketRequests: " + apiResposne.stats.socketServer.numberOfLocalSocketRequests);
	
			// Action should have an error, not all the params are provided
			A.action("cacheTest", function(apiResposne){
				console.log("cacheTest (try 1) Error: " + apiResposne.error);
	
				// Action should be OK now
				params = { key: "mykey", value: "myValue" };
				A.actionWithParams("cacheTest", params, function(apiResposne){
					console.log("cacheTest (try 2) Error: " + apiResposne.error);
	
					//cool, lets leave
					A.disconnect();
					setTimeout(process.exit, 1000); // leave some time for the "end" even to fire
				});
			});
		});
	});
