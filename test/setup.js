exports.setup = {
  ServerPrototype: require('../node_modules/actionhero/actionhero.js'),
  serverConfigChanges: {
    general: {
      id: 'test-server-1',
      workers: 1,
      developmentMode: false,
      startingChatRooms: {
        'defaultRoom': {},
        'otherRoom': {}
      }
    },
    logger: { transports: null },
    // logger: {
    //   transports: [
    //     function(api, winston){
    //       return new (winston.transports.Console)({
    //         colorize: true,
    //         level: 'info',
    //         timestamp: api.utils.sqlDateTime
    //       });
    //     }
    //   ]
    // },
    servers: {
      web: { enabled: false },
      websocket: { enabled: false },
      socket: {
        enabled: true,
        secure: false,
        port: 9000
      }
    }
  },

  startServer: function (callback) {
    var self = this

    if (!self.server) {
      process.env.ACTIONHERO_CONFIG = process.cwd() + '/node_modules/actionhero/config/'
      self.server = new self.ServerPrototype()
      self.server.start({configChanges: self.serverConfigChanges}, function (err, api) {
        self.api = api
        callback(err, self.api)
      })
    } else {
      process.nextTick(function () {
        callback()
      })
    }
  },

  stopServer: function (callback) {
    var self = this

    self.server.stop(function () {
      callback()
    })
  }
}
