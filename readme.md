# ActionheroNodeClient
For one node.js servers talking to another ActionHero server, over the socket protocol.

![NPM Version](https://img.shields.io/npm/v/actionhero-node-client.svg?style=flat) ![Node Version](https://img.shields.io/node/v/actionhero-node-client.svg?style=flat) [![Greenkeeper badge](https://badges.greenkeeper.io/actionhero/actionhero-node-client.svg)](https://greenkeeper.io/) [![test](https://github.com/actionhero/actionhero-node-client/actions/workflows/test.yml/badge.svg)](https://github.com/actionhero/actionhero-node-client/actions/workflows/test.yml)

This library makes it easy for one nodeJS process to talk to a remote [actionhero](https://www.actionherojs.com/) server.

This library makes use of actionhero's TCP socket connections to enable fast, stateful connections.  This library also allows for many concurrent and asynchronous requests to be running in parallel by making use of actionhero's message counter.

**notes:**
* This Library is a server-server communication library, and is NOT the same as the websocket client library that is generated via the actionhero server.
* Node.js v8+ is required to use this package, as it uses `async/await`.

## Setup

Installation should be as simple as:

```javascript
npm install --save actionhero-node-client
```

and then you can include it in your projects with:

```javascript
var ActionheroNodeClient = require("actionhero-node-client");
var client = new ActionheroNodeClient();
```

Once you have included the ActionheroClient library within your project, you can connect like this:

```javascript
await client.connect({
  host: "127.0.0.1",
  port: "5000",
});
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
## Methods

One you are connected (by waiting for the "connected" event or using the `connect` callback), the following methods will be available to you:

* `await ActionheroNodeClient.connect()`
* `await ActionheroNodeClient.disconnect()`
* `{error, data, delta} = await ActionheroNodeClient.paramAdd(key, value)`
  * remember that both key and value must pass JSON.stringify
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `{error, data, delta} = await ActionheroNodeClient.paramDelete(key)`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `{error, data, delta} = await ActionheroNodeClient.paramsDelete()`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `{error, data, delta} = await ActionheroNodeClient.paramView(key)`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `{error, data, delta} = await ActionheroNodeClient.paramsView()`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `{error, data, delta} = await ActionheroNodeClient.details()`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `{error, data, delta} = await ActionheroNodeClient.roomView(room)`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `{error, data, delta} = await ActionheroNodeClient.roomAdd(room)`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `{error, data, delta} = await ActionheroNodeClient.roomLeave(room)`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `{error, data, delta} = await ActionheroNodeClient.say(room, msg)`
  * `msg` can be a string or an Object
* {error, data, delta} = await `ActionheroNodeClient.action(action)`
  * this action method will not set or unset any params, and use those already set by `paramAdd`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)
* `ActionheroNodeClient.actionWithParams(action, param)`
  * this action will ignore any previously set params to the connection
  * params is a hash of this form `{key: "myKey", value: "myValue"}`
  * The return value will contain the response from the server (`data`), a possible error (`error`), and the response's duration (`delta`)

## Events

ActionheroNodeClient will emit a few types of events (many of which are caught in the example below).  Here are the events, and how you might catch them:

* `client.on("connected")`
* `client.on("end")`
* `client.on("welcome", (welcomeMessage) => {})`
  * welcomeMessage is a string
* `client.on("error", (error) => {})`
  * errorMessage is a string
  * This is only emitted for connection errors, not errors to your requests/actions
* `client.on("say", (message) => {})`
  * message is a hash containing `timeStamp`, `room`, `from`, and `message`
* `client.on("timeout", (error, request, caller) => {})`
  * request is the string sent to the api
  * caller (the calling function) is also returned to with an error

## Data

There are a few data elements you can inspect on `actionheroClient`:

* `ActionheroNodeClient.lastLine`
  * This is the last parsed JSON message received from the server (chronologically, not by messageID)
* `ActionheroNodeClient.userMessages`
  * a hash which contains the latest `say` message from all users
* `ActionheroNodeClient.log`
  * An array of the last n parsable JSON replies from the server
  * each entry is of the form {data, timeStamp} where data was the server's full response
* `ActionheroNodeClient.messageCount`
  * An integer counting the number of messages received from the server

## Example

```javascript
var ActionheroNodeClient = require("actionhero-node-client");

async function main () {
  const client = new ActionheroNodeClient()

  client.on('say', (message) => {
    console.log(' > SAY: ' + message.message + ' | from: ' + message.from)
  })

  client.on('welcome', (welcome) => {
    console.log('WELCOME: ' + welcome)
  })

  client.on('error', (error) => {
    console.log('ERROR: ' + error)
  })

  client.on('end', () => {
    console.log('Connection Ended')
  })

  client.on('timeout', (request, caller) => {
    console.log(request + ' timed out')
  })

  await client.connect({host: '127.0.0.1', port: '5000'})

  // get details about myself
  console.log('My Details: ', client.details)

  // try an action
  const params = { key: 'mykey', value: 'myValue' }
  let {error, data, delta} = await client.actionWithParams('cacheTest', params)
  if (error) { throw error }
  console.log('cacheTest action response: ', data)
  console.log(' ~ request duration: ', delta)

  // join a chat room and talk
  await client.roomAdd('defaultRoom')
  await client.say('defaultRoom', 'Hello from the actionheroClient')
  await client.roomLeave('defaultRoom')

  // leave
  await client.disconnect()
  console.log('all done!')
}

main()

```
