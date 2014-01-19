var should = require("should")
var setup = require("./_setup.js")._setup;
var connectionParams = {
  host: "0.0.0.0",
  port: "9000",
  timeout: 1000,
};
var action_hero_client = require(process.cwd() + "/lib/actionhero_client.js");
var A = new action_hero_client;

describe('integration', function(){  
  
  before(function(done){
    setup.init(function(){
      A.on("connected", function(){
        done();
      });
      A.connect(connectionParams);
    });
  });

  it("actionhero server should have booted", function(done){
    setup.api.should.be.an.instanceOf(Object);
    done();
  });

  it("can get my connection details", function(done){
    A.details(function(err, details, delta){
      details.status.should.equal("OK");
      details.context.should.equal("response");
      details.data.totalActions.should.equal(0);
      details.data.pendingActions.should.equal(0);
      done();
    });
  });

  it("should log server messages internally", function(done){
    A.log.length.should.equal(2);
    A.log[0].data.welcome.should.equal("Hello! Welcome to the actionhero api");
    done()
  });

  it("should be able to set params", function(done){
    A.paramAdd("key", "value", function(err, response){
      response.status.should.equal("OK");
      A.paramsView(function(err, params){
        params.data.key.should.equal("value");
        done()
      });
    })
  });

  it("can delete params and confirm they are gone", function(done){
    A.paramsDelete(function(err, response){
      response.status.should.equal("OK");
      A.paramsView(function(err, params){
        should.not.exist(params.data.key);
        done();
      });
    })
  });

  it("can delete params and confirm they are gone", function(done){
    A.paramsDelete(function(err, response){
      response.status.should.equal("OK");
      A.paramsView(function(err, params){
        should.not.exist(params.data.key);
        done();
      });
    })
  });

  it("can run an action (simple)", function(done){
    A.action("status", function(err, apiResposne){
      apiResposne.uptime.should.be.above(0);
      apiResposne.context.should.equal("response");
      done();
    });
  });

  it("can run an action (complex)", function(done){
    var params = { key: "mykey", value: "myValue" };
    A.actionWithParams("cacheTest", params, function(err, apiResposne){
      apiResposne.context.should.equal("response");
      apiResposne.cacheTestResults.saveResp.should.equal(true);
      done();
    });
  });

  it("can join a room", function(done){
    A.roomChange('defaultRoom', function(err, data){
      A.details(function(err, data){
        data.data.room.should.equal('defaultRoom');
        done();
      });
    });
  })

  it("will get SAY events", function(done){
    var used = false;
    A.roomChange('defaultRoom', function(){
      A.on("say",function(msgBlock){
        if(used == false){
          used = true;
          msgBlock.message.should.equal("TEST MESSAGE");
          done();
        }
      });
      setup.api.chatRoom.socketRoomBroadcast({room: 'defaultRoom'}, "TEST MESSAGE");
    });
  });

  it("will obey timeouts", function(done){
    this.timeout(5 * 1000)

    setup.api.actions.versions['slowAction'] = [ 1 ];
    setup.api.actions.actions['slowAction'] = {
      "1":{ 
        name: "slowAction",
        description: "I am slow",
        inputs: { required: [], optional: [] },
        outputExample: { },
        run:function(api, connection, next){
          setTimeout(function(){
            next(connection, true);
          },10000)
        }
      }
    }

    A.on('timeout', function(err, request, caller){
      String(err).should.equal("Error: Timeout reached");
      request.should.equal("slowAction");
      done()
    });

    A.action("slowAction", function(err, apiResposne){
      console.log(apiResposne)
      throw new Error("I should not get here")
    });
  });

});