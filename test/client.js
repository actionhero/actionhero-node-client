const should = require('should')
const path = require('path')
const ActionheroNodeClient = require(path.join(__dirname, '/../lib/client.js'))
const ActionHero = require('actionhero')
const actionhero = new ActionHero.Process()

const port = 9000

process.env.ACTIONHERO_CONFIG = path.join(__dirname, '..', 'node_modules', 'actionhero', 'config')

const serverConfig = {
  general: {
    id: 'test-server-1',
    workers: 1,
    developmentMode: false,
    startingChatRooms: {
      'defaultRoom': {},
      'otherRoom': {}
    }
  },
  servers: {
    web: { enabled: false },
    websocket: { enabled: false },
    socket: {
      enabled: true,
      secure: false,
      port: port
    }
  }
}

const connectionParams = {
  host: '0.0.0.0',
  port: port,
  timeout: 1000
}

let api
let client

describe('integration', () => {
  before(async () => { api = await actionhero.start({configChanges: serverConfig}) })
  after(async () => { await actionhero.stop() })

  beforeEach(async () => {
    client = new ActionheroNodeClient()
    await client.connect(connectionParams)
  })

  afterEach(async () => {
    await client.disconnect()
  })

  it('actionhero server should have booted', () => {
    api.should.be.an.instanceOf(Object)
  })

  it('can get my connection details', async () => {
    let details = await client.detailsView()
    details.status.should.equal('OK')
    details.context.should.equal('response')
    details.data.totalActions.should.equal(0)
    details.data.pendingActions.should.equal(0)
  })

  it('should log server messages internally', async () => {
    client.log.length.should.be.above(0)
    client.log[0].data.welcome.should.equal('Hello! Welcome to the actionhero api')
  })

  it('should be able to set params', async () => {
    let {error, data} = await client.paramAdd('key', 'value')
    should.not.exist(error)
    data.status.should.equal('OK')

    let {error: error2, data: data2} = await client.paramView('key')
    should.not.exist(error2)
    data2.data.should.equal('value')

    let {error: error3, data: data3} = await client.paramsView()
    should.not.exist(error3)
    data3.data.key.should.equal('value')
  })

  it('can delete params and confirm they are gone', async () => {
    let {error} = await client.paramAdd('key', 'value')
    should.not.exist(error)

    let {error: error2, data: data2} = await client.paramsDelete()
    should.not.exist(error2)
    data2.status.should.equal('OK')

    let {error: error3, data: data3} = await client.paramsView()
    should.not.exist(error3)
    should.not.exist(data3.data.key)
  })

  it('can delete a param and confirm they are gone', async () => {
    let {error: error1} = await client.paramAdd('key', 'v1')
    should.not.exist(error1)

    let {error: error2} = await client.paramAdd('value', 'v2')
    should.not.exist(error2)

    let {error: error3} = await client.paramDelete('key')
    should.not.exist(error3)

    let {error: error4, data} = await client.paramsView()
    should.not.exist(error4)
    Object.keys(data.data).length.should.equal(1)
    data.data.value.should.equal('v2')
  })

  it('can run an action (success, simple params)', async () => {
    let {error, data} = await client.action('status')
    should.not.exist(error)
    data.uptime.should.be.above(0)
    data.context.should.equal('response')
  })

  it('can run an action (failure, simple params)', async () => {
    let {error, data} = await client.action('cacheTest')
    error.message.should.match(/key is a required parameter for this action/)
    data.context.should.equal('response')
  })

  it('can run an action (success, complex params)', async () => {
    var params = { key: 'mykey', value: 'myValue' }
    let {error, data} = await client.actionWithParams('cacheTest', params)
    should.not.exist(error)
    data.context.should.equal('response')
    data.cacheTestResults.saveResp.should.equal(true)
  })

  it('can run an action (failure, complex params)', async () => {
    var params = { key: 'mykey', value: 'v' }
    let {error, data} = await client.actionWithParams('cacheTest', params)
    error.message.should.match(/inputs should be at least 3 letters long/)
    data.context.should.equal('response')
  })

  it('can join a room', async () => {
    await client.roomAdd('defaultRoom')
    let {data} = await client.roomView('defaultRoom')
    data.data.room.should.equal('defaultRoom')
    data.data.membersCount.should.equal(1)
    Object.keys(data.data.members).length.should.equal(1)
    Object.keys(data.data.members)[0].should.equal(client.id)
  })

  it('can leave a room', async () => {
    let {error: error1, data: data1} = await client.detailsView()
    should.not.exist(error1)
    data1.rooms.length.should.equal(0)

    let {error: error2} = await client.roomAdd('defaultRoom')
    should.not.exist(error2)

    let {error: error3, data: data3} = await client.roomView('defaultRoom')
    should.not.exist(error3)
    Object.keys(data3.data.members).should.containEql(client.id)

    let {error: error4} = await client.roomLeave('defaultRoom')
    should.not.exist(error4)

    let {error: error5, data: data5} = await client.detailsView()
    should.not.exist(error5)
    data5.rooms.length.should.equal(0)
  })

  it('will translate bad status to an error callback', async () => {
    let {error} = await client.roomView('someCrazyRoom')
    error.message.should.equal('connection not in this room (someCrazyRoom)')
  })

  it('will get SAY events', async () => {
    await client.roomAdd('defaultRoom')

    await new Promise((resolve) => {
      client.on('say', (message) => {
        client.removeAllListeners('say')
        message.message.should.equal('TEST MESSAGE')
        return resolve()
      })

      api.chatRoom.broadcast({}, 'defaultRoom', 'TEST MESSAGE')
    })
  })

  it('will obey the server\'s simultaneousActions policy', async () => {
    let count = 0
    await new Promise(async (resolve) => {
      function tryResolve (response) {
        count++
        if (count === 5) { resolve() }
      }

      client.actionWithParams('sleepTest', {sleepDuration: 100}).then(tryResolve)
      client.actionWithParams('sleepTest', {sleepDuration: 200}).then(tryResolve)
      client.actionWithParams('sleepTest', {sleepDuration: 300}).then(tryResolve)
      client.actionWithParams('sleepTest', {sleepDuration: 400}).then(tryResolve)
      client.actionWithParams('sleepTest', {sleepDuration: 500}).then(tryResolve)
      let response6 = client.actionWithParams('sleepTest', {sleepDuration: 600})

      await response6.then(({error, data}) => {
        String(error).should.equal('Error: you have too many pending requests')
        data.error.should.equal('you have too many pending requests')
      })
    })
  })

  it('will obey timeouts', async () => {
    try {
      await client.actionWithParams('sleepTest', {sleepDuration: 2 * 1000})
      throw new Error('should not get here')
    } catch (error) {
      error.should.match(/Timeout reached/)
    }
  })

  it('will obey timeouts again', async () => {
    try {
      await client.actionWithParams('sleepTest', {sleepDuration: 2 * 1000})
      throw new Error('should not get here')
    } catch (error) {
      error.should.match(/Timeout reached/)
    }
  })

  it('can reconnect')
})
