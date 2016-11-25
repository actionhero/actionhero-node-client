var path = require('path')

var ActionheroClient = require(path.join(__dirname, '/lib/actionhero-client.js'))
var client = new ActionheroClient()

client.on('say', function (msgBlock) {
  console.log(' > SAY: ' + msgBlock.message + ' | from: ' + msgBlock.from)
})

client.on('welcome', function (msg) {
  console.log('WELCOME: ' + msg)
})

client.on('error', function (error, data) {
  console.log('ERROR: ' + error)
  if (data) { console.log(data) }
})

client.on('end', function () {
  console.log('Connection Ended')
})

client.on('timeout', function (error, request, caller) {
  if (error) { throw error }
  console.log(request + ' timed out')
})

client.connect({
  host: '127.0.0.1',
  port: '5000'
}, function () {
  // get details about myself
  console.log(client.details)

  // try an action
  var params = { key: 'mykey', value: 'myValue' }
  client.actionWithParams('cacheTest', params, function (error, apiResponse, delta) {
    if (error) { throw error }
    console.log('cacheTest action response: ' + apiResponse.cacheTestResults.saveResp)
    console.log(' ~ request duration: ' + delta + 'ms')
  })

  // join a chat room and talk
  client.roomAdd('defaultRoom', function (error) {
    if (error) { throw error }
    client.say('defaultRoom', 'Hello from the actionheroClient')
    client.roomLeave('defaultRoom')
  })

  // leave
  setTimeout(function () {
    client.disconnect(function () {
      console.log('all done!')
    })
  }, 1000)
})
