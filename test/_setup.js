exports._setup = {
  serverPrototype: require("../node_modules/actionHero/actionHero.js").actionHeroPrototype,
  serverConfigChanges: {
    general: {
      id: "test-server-1",
      workers: 1,
      developmentMode: false
    },
    logger: { transports: null, },
    servers: {
      socket: {
        secure: false, 
        port: 9000,    
      },
    }
  },
  bootServer: function(callback){
    var self = this;
    if(self.server == null){
      process.env.ACTIONHERO_CONFIG = process.cwd() + "/node_modules/actionHero/config.js";
      self.server = new self.serverPrototype();
      self.server.start({configChanges: self.serverConfigChanges}, function(err, api){
        self.api = api;
        callback();
      });
    }else{
      self.server.restart(function(){
        callback();
      });
    }
  },
  init: function(callback){
    var self = this;
    self.bootServer(function(){
      callback();
    });
  }
}