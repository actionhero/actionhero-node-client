#actionhero_client (for nodeJS)

[![build status](https://secure.travis-ci.org/evantahler/actionhero_client.png)](http://travis-ci.org/evantahler/actionhero_client) 

This library makes it easy for one nodeJS process to talk to a remote [actionhero](http://actionherojs.com/) server.

This library makes use of actionhero's TCP socket connections to enable fast, stateful connections.  This library also allows for many concurrent and asynchronous requests to be running in parallel by making use of actionhero's message counter.  This library is at times event-driven, and for functions that makes sense to do so, callback based.

## Setup

Installation should be as simple as:

```javascript
npm install actionhero_client
```

and then you can include it in your projects with:

```javascript
var actionhero_client = require("actionhero_client").actionhero_client;
```

Once you have included the actionheroClient library within your project, you can connect like this:

```javascript
actionhero_client.connect({
  host: "127.0.0.1",
  port: "5000",
}, callback);
```

default options (which you can ovveride) are:

```javascript
var defaults = {
  host: "127.0.0.1",
  port: "5000",
  delimiter: "\r\n",
  logLength: 100,
  secure: false,
  timeout: 30000,
};
```

## Events

actionhero_client will emit a few types of events (many of which are caught in the example below).  Here are the events, and how you might catch them:

* `actionhero_client.on("connected", function(null){})`
* `actionhero_client.on("end", function(null){})`
* `actionhero_client.on("welcome", function(welcomeMessage){})`
  * welcomeMessage is a string
* `actionhero_client.on("error", function(errorMessage){})`
  * errorMessage is a string
* `actionhero_client.on("say", function(messageBlock){})`
  * messageBlock is a hash containing `timeStamp`, `from`, and `message`
* `actionhero_client.on("timeout", function(err, request, caller){})`
  * request is the string sent to the api
  * caller (the calling function) is returned if your api requset didn't complete within `params.callback`
## Methods

One you are connected (by waiting for the "connected" event), the following methods will be available to you:

* `actionhero_client.disconnect(next)`
* `actionhero_client.paramAdd(key,value,next)`
  * remember that both key and value must pass JSON.stringify
* `actionhero_client.paramDelete(key,next)`
* `actionhero_client.paramsDelete(next)`
* `actionhero_client.paramView(key,next)`
* `actionhero_client.paramsView(next)`
* `actionhero_client.roomView(next)`
* `actionhero_client.details(next)`
* `actionhero_client.roomChange(room,next)`
* `actionhero_client.say(msg,next)`
* `actionhero_client.action(action,next)`
  * this basic action method will not set or unset any params  
  * next will be passed (err, data, duration)
* `actionhero_client.actionWithParams(action,params,next)`
  * this action will ignore any previously set params to the connection
  * params is a hash of this form `{key: "myKey", value: "myValue"}` 
  * next will be passed (err, data, duration)

Each callback will receive the full data hash returned from the server and a timestamp: `(err, data, duration)`


## Data 

There are a few data elements you can inspect on `actionhero_client`:

* `actionhero_client.lastLine`
  * This is the last parsed JSON message received from the server (chronologically, not by messageID)
* `actionhero_client.userMessages`
  * a hash which contains the latest `say` message from all users
* `actionhero_client.log`
  * An array of the last n parsable JSON replies from the server
  * each entry is of the form {data, timeStamp} where data was the server's full response
* `actionhero_client.messageCount` 
  * An integer counting the number of messages received from the server

## Example

```javascript
var action_hero_client = require("./actionhero_client.js");
var A = new action_hero_client;

A.on("say",function(msgBlock){
  console.log(" > SAY: " + msgBlock.message + " | from: " + msgBlock.from);
});

A.on("welcome", function(msg){
  console.log("WELCOME: " + msg);
});

A.on("error", function(err){
  console.log("ERROR: " + err);
});

A.on("end", function(){
  console.log("Connection Closed");
});

A.on("timeout", function(err, request, caller){
  console.log(request + " timed out");
});

A.connect({
  host: "127.0.0.1",
  port: "5000",
});

A.on("connected", function(){
  console.log("\r\nCONNECTED\r\n");
  A.action("status", function(err, apiResposne, delta){
    console.log("STATUS:");
    console.log(" > uptime: " + apiResposne.uptime);
    console.log(" ~ request duration: " + delta + "ms");

    // Action should have an error, not all the params are provided
    A.action("cacheTest", function(err, apiResposne, delta){
      console.log("cacheTest (try 1) Error: " + apiResposne.error);
      console.log(" ~ request duration: " + delta + "ms");

      // Action should be OK now
      var params = { key: "mykey", value: "myValue" };
      A.actionWithParams("cacheTest", params, function(err, apiResposne, delta){
        console.log("cacheTest (try 2) response: " + apiResposne.cacheTestResults.saveResp);
        console.log(" ~ request duration: " + delta + "ms");

        console.log("\r\nWorking!");

        //cool, lets leave
        A.disconnect();
        setTimeout(process.exit, 1000); // leave some time for the "end" even to fire
      });
    });
  });
});
```
