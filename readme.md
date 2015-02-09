#actionheroClient (for nodeJS)

[![Build Status](https://travis-ci.org/evantahler/actionhero-client.svg?branch=master)](https://travis-ci.org/evantahler/actionhero-client)

This library makes it easy for one nodeJS process to talk to a remote [actionhero](http://actionherojs.com/) server.

This library makes use of actionhero's TCP socket connections to enable fast, stateful connections.  This library also allows for many concurrent and asynchronous requests to be running in parallel by making use of actionhero's message counter.

## Setup

Installation should be as simple as:

```javascript
npm install --save actionhero-client
```

and then you can include it in your projects with:

```javascript
var actionheroClient = require("actionhero-client");
var client = new actionheroClient();
```

Once you have included the actionheroClient library within your project, you can connect like this:

```javascript
client.connect({
  host: "127.0.0.1",
  port: "5000",
}, callback);
```

default options (which you can override) are:

```javascript
var defaults = {
  host: "127.0.0.1",
  port: "5000",
  delimiter: "\r\n",
  logLength: 100,
  secure: false,
  timeout: 5000,
  reconnectTimeout: 1000,
  reconnectAttempts: 10,
};
```

## Events

actionheroClient will emit a few types of events (many of which are caught in the example below).  Here are the events, and how you might catch them:

* `client.on("connected", function(null){})`
* `client.on("end", function(null){})`
* `client.on("welcome", function(welcomeMessage){})`
  * welcomeMessage is a string
* `client.on("error", function(errorMessage){})`
  * errorMessage is a string
* `client.on("say", function(messageBlock){})`
  * messageBlock is a hash containing `timeStamp`, `room`, `from`, and `message`
* `client.on("timeout", function(err, request, caller){})`
  * request is the string sent to the api
  * caller (the calling function) is also returned to with an error
## Methods

One you are connected (by waiting for the "connected" event or using the `connect` callback), the following methods will be available to you:

* `actionheroClient.disconnect(next)`
* `actionheroClient.paramAdd(key,value,next)`
  * remember that both key and value must pass JSON.stringify
* `actionheroClient.paramDelete(key,next)`
* `actionheroClient.paramsDelete(next)`
* `actionheroClient.paramView(key,next)`
* `actionheroClient.paramsView(next)`
* `actionheroClient.details(next)`
* `actionheroClient.roomView(room, next)`
* `actionheroClient.roomAdd(room,next)`
* `actionheroClient.roomLeave(room,next)`
* `actionheroClient.say(room, msg, next)`
* `actionheroClient.action(action, next)`
  * this basic action method will not set or unset any params  
  * next will be passed (err, data, duration)
* `actionheroClient.actionWithParams(action, params, next)`
  * this action will ignore any previously set params to the connection
  * params is a hash of this form `{key: "myKey", value: "myValue"}` 
  * next will be passed (err, data, duration)

Each callback will receive the full data hash returned from the server and a timestamp: `(err, data, duration)` 

## Data 

There are a few data elements you can inspect on `actionheroClient`:

* `actionheroClient.lastLine`
  * This is the last parsed JSON message received from the server (chronologically, not by messageID)
* `actionheroClient.userMessages`
  * a hash which contains the latest `say` message from all users
* `actionheroClient.log`
  * An array of the last n parsable JSON replies from the server
  * each entry is of the form {data, timeStamp} where data was the server's full response
* `actionheroClient.messageCount`
  * An integer counting the number of messages received from the server

## Example

```javascript
var actionheroClient = require("actionhero-client");
var client = new actionheroClient();

client.on("say", function(msgBlock){
  console.log(" > SAY: " + msgBlock.message + " | from: " + msgBlock.from);
});

client.on("welcome", function(msg){
  console.log("WELCOME: " + msg);
});

client.on("error", function(err, data){
  console.log("ERROR: " + err);
  if(data){ console.log(data); }
});

client.on("end", function(){
  console.log("Connection Ended");
});

client.on("timeout", function(err, request, caller){
  console.log(request + " timed out");
});

client.connect({
  host: "127.0.0.1",
  port: "5000",
}, function(){
  // get details about myself
  console.log(client.details);
  
  // try an action
  var params = { key: "mykey", value: "myValue" };
  client.actionWithParams("cacheTest", params, function(err, apiResposne, delta){
    console.log("cacheTest action response: " + apiResposne.cacheTestResults.saveResp);
    console.log(" ~ request duration: " + delta + "ms");
  });

  // join a chat room and talk
  client.roomAdd("defaultRoom", function(err){
    client.say("defaultRoom", "Hello from the actionheroClient");
    client.roomLeave("defaultRoom");
  });

  // leave
  setTimeout(function(){
    client.disconnect(function(){
      console.log("all done!");
    });
  }, 1000);

});
```
