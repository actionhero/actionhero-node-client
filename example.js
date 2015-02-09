var actionheroClient = require(__dirname + "/lib/actionhero-client.js");
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