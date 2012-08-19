var A = require("./actionhero_client.js").actionhero_client;
	
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
				console.log("Working!");

				//cool, lets leave
				A.disconnect();
				setTimeout(process.exit, 1000); // leave some time for the "end" even to fire
			});
		});
	});
});