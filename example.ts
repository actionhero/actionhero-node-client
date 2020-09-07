// you will need an Actionhero server running the Actionhero Socket Server (https://github.com/actionhero/actionhero-socket-server)

import ActionheroNodeClient from "./src/lib/client";

async function main() {
  const client = new ActionheroNodeClient();

  client.on("say", (message) => {
    console.log(" > SAY: " + message.message + " | from: " + message.from);
  });

  client.on("welcome", (welcome) => {
    console.log("WELCOME: " + welcome);
  });

  client.on("error", (error) => {
    console.log("ERROR: " + error);
  });

  client.on("end", () => {
    console.log("Connection Ended");
  });

  client.on("timeout", (request) => {
    console.log(request + " timed out");
  });

  await client.connect({ host: "127.0.0.1", port: 5000 });

  // get details about myself
  console.log("My Details: ", client.details);

  // try an action
  const params = { key: "mykey", value: "myValue" };
  const { error, data, delta } = await client.actionWithParams(
    "cacheTest",
    params
  );
  if (error) throw error;

  console.log("cacheTest action response: ", data);
  console.log(" ~ request duration: ", delta);

  // join a chat room and talk
  await client.roomAdd("defaultRoom");
  await client.say("defaultRoom", "Hello from the actionheroClient");
  await client.roomLeave("defaultRoom");

  // leave
  await client.disconnect();
  console.log("all done!");
}

main();
