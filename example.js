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
		console.log(" > uptimeSeconds: " + apiResposne.stats.uptimeSeconds);
		console.log(" > numberOfLocalSocketRequests: " + apiResposne.stats.socketServer.numberOfLocalSocketRequests);
		console.log(" ~ request duration: " + delta + "ms");

		// Action should have an error, not all the params are provided
		A.action("cacheTest", function(err, apiResposne, delta){
			console.log("cacheTest (try 1) Error: " + apiResposne.error);
			console.log(" ~ request duration: " + delta + "ms");

			// Action should be OK now
			params = { key: "mykey", value: "myValue" };
			A.actionWithParams("cacheTest", params, function(err, apiResposne, delta){
				console.log("cacheTest (try 2) Error: " + apiResposne.error);
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