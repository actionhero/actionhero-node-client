var should = require('should')
var path = require('path')
var setup = require(path.join(__dirname, '/setup.js')).setup
var ActionheroClient = require(path.join(__dirname, '/../lib/actionhero-client.js'))
var client

var connectionParams = {
  host: '0.0.0.0',
  port: setup.serverConfigChanges.servers.socket.port,
  timeout: 1000
}

describe('integration', function () {
  beforeEach(function (done) {
    client = new ActionheroClient()
    setup.startServer(function () {
      client.connect(connectionParams, function () {
        done()
      })
    })
  })

  it('actionhero server should have booted', function (done) {
    setup.api.should.be.an.instanceOf(Object)
    done()
  })

  it('can get my connection details', function (done) {
    client.detailsView(function (erroror, details, delta) {
      should.not.exist(erroror)
      details.status.should.equal('OK')
      details.context.should.equal('response')
      details.data.totalActions.should.equal(0)
      details.data.pendingActions.should.equal(0)
      done()
    })
  })

  it('should log server messages internally', function (done) {
    client.log.length.should.equal(2)
    client.log[0].data.welcome.should.equal('Hello! Welcome to the actionhero api')
    done()
  })

  it('should be able to set params', function (done) {
    client.paramAdd('key', 'value', function (erroror, response) {
      should.not.exist(erroror)
      response.status.should.equal('OK')
      client.paramsView(function (erroror, params) {
        params.data.key.should.equal('value')
        done()
      })
    })
  })

  it('can delete params and confirm they are gone', function (done) {
    client.paramAdd('key', 'value', function (erroror, response) {
      should.not.exist(erroror)
      client.paramsDelete(function (erroror, response) {
        should.not.exist(erroror)
        response.status.should.equal('OK')
        client.paramsView(function (erroror, params) {
          should.not.exist(erroror)
          should.not.exist(params.data.key)
          done()
        })
      })
    })
  })

  it('can delete a param and confirm they are gone', function (done) {
    client.paramAdd('key', 'v1', function (erroror, response) {
      should.not.exist(erroror)
      client.paramAdd('value', 'v2', function (erroror, response) {
        should.not.exist(erroror)
        client.paramDelete('key', function (erroror, response) {
          should.not.exist(erroror)
          client.paramsView(function (erroror, params) {
            Object.keys(params.data).length.should.equal(1)
            params.data.value.should.equal('v2')
            done()
          })
        })
      })
    })
  })

  it('can run an action (simple params)', function (done) {
    client.action('status', function (erroror, apiResponse) {
      should.not.exist(erroror)
      apiResponse.uptime.should.be.above(0)
      apiResponse.context.should.equal('response')
      done()
    })
  })

  it('can run an action (complex params)', function (done) {
    var params = { key: 'mykey', value: 'myValue' }
    client.actionWithParams('cacheTest', params, function (erroror, apiResponse) {
      should.not.exist(erroror)
      apiResponse.context.should.equal('response')
      apiResponse.cacheTestResults.saveResp.should.equal(true)
      done()
    })
  })

  it('can join a room', function (done) {
    client.roomAdd('defaultRoom', function (erroror, data) {
      client.roomView('defaultRoom', function (erroror, data) {
        Object.keys(data.data.members).length.should.equal(1)
        Object.keys(data.data.members)[0].should.equal(client.id)
        done()
      })
    })
  })

  it('can leave a room', function (done) {
    client.detailsView(function (error, data) {
      should.not.exist(error)
      data.data.rooms.length.should.equal(0)
      client.roomAdd('defaultRoom', function (error, data) {
        should.not.exist(error)
        client.roomView('defaultRoom', function (error, data) {
          should.not.exist(error)
          Object.keys(data.data.members).should.containEql(client.id)

          client.roomLeave('defaultRoom', function (error, data) {
            should.not.exist(error)
            client.detailsView(function (error, data) {
              should.not.exist(error)
              data.data.rooms.length.should.equal(0)
              done()
            })
          })
        })
      })
    })
  })

  it('will translate bad status to an error callback', function (done) {
    client.roomView('someCrazyRoom', function (error, data) {
      String(error).should.equal('Error: not member of room someCrazyRoom')
      data.status.should.equal('not member of room someCrazyRoom')
      done()
    })
  })

  it('will get SAY events', function (done) {
    var used = false
    client.roomAdd('defaultRoom', function () {
      client.on('say', function (msgBlock) {
        if (used === false) {
          used = true
          msgBlock.message.should.equal('TEST MESSAGE')
          done()
        }
      })

      setup.api.chatRoom.broadcast({}, 'defaultRoom', 'TEST MESSAGE')
    })
  })

  it('will obey the servers simultaneousActions policy', function (done) {
    client.actionWithParams('sleepTest', {sleepDuration: 500})
    client.actionWithParams('sleepTest', {sleepDuration: 500})
    client.actionWithParams('sleepTest', {sleepDuration: 500})
    client.actionWithParams('sleepTest', {sleepDuration: 500})
    client.actionWithParams('sleepTest', {sleepDuration: 500})
    client.actionWithParams('sleepTest', {sleepDuration: 500}, function (error, apiResponse) {
      String(error).should.equal('Error: you have too many pending requests')
      apiResponse.error.should.equal('you have too many pending requests')
      done()
    })
  })

  it('will obey timeouts', function (done) {
    client.actionWithParams('sleepTest', {sleepDuration: 2 * 1000}, function (error, apiResponse) {
      String(error).should.equal('Error: Timeout reached')
      should.not.exist(apiResponse)
      done()
    })
  })
})

describe('connection and reconnection', function () {
  // TODO
})
