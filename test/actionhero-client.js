var should = require("should");
var setup = require(__dirname + "/setup.js").setup;
var actionheroClient = require(__dirname + "/../lib/actionhero-client.js");
var client;

var connectionParams = {
  host: "0.0.0.0",
  port: setup.serverConfigChanges.servers.socket.port,
  timeout: 1000,
};


describe('integration', function(){  
  
  beforeEach(function(done){
    client = new actionheroClient();
    setup.startServer(function(){
      client.connect(connectionParams, function(){
        done();
      });
    });
  });

  it("actionhero server should have booted", function(done){
    setup.api.should.be.an.instanceOf(Object);
    done();
  });

  it("can get my connection details", function(done){
    client.detailsView(function(err, details, delta){
      should.not.exist(err);
      details.status.should.equal("OK");
      details.context.should.equal("response");
      details.data.totalActions.should.equal(0);
      details.data.pendingActions.should.equal(0);
      done();
    });
  });

  it("should log server messages internally", function(done){
    client.log.length.should.equal(2);
    client.log[0].data.welcome.should.equal("Hello! Welcome to the actionhero api");
    done();
  });

  it("should be able to set params", function(done){
    client.paramAdd("key", "value", function(err, response){
      should.not.exist(err);
      response.status.should.equal("OK");
      client.paramsView(function(err, params){
        params.data.key.should.equal("value");
        done();
      });
    });
  });

  it("can delete params and confirm they are gone", function(done){
    client.paramAdd("key", "value", function(err, response){
      should.not.exist(err);
      client.paramsDelete(function(err, response){
        should.not.exist(err);
        response.status.should.equal("OK");
        client.paramsView(function(err, params){
          should.not.exist(err);
          should.not.exist(params.data.key);
          done();
        });
      });
    });
  });

  it("can delete a param and confirm they are gone", function(done){
    client.paramAdd("key", "v1", function(err, response){
      should.not.exist(err);
      client.paramAdd("value", "v2", function(err, response){
        should.not.exist(err);
        client.paramDelete("key", function(err, response){
          should.not.exist(err);
          client.paramsView(function(err, params){
            Object.keys( params.data ).length.should.equal(1);
            params.data.value.should.equal("v2");
            done();
          });
        });
      });
    });
  });

  it("can run an action (simple params)", function(done){
    client.action("status", function(err, apiResposne){
      should.not.exist(err);
      apiResposne.uptime.should.be.above(0);
      apiResposne.context.should.equal("response");
      done();
    });
  });

  it("can run an action (complex params)", function(done){
    var params = { key: "mykey", value: "myValue" };
    client.actionWithParams("cacheTest", params, function(err, apiResposne){
      should.not.exist(err);
      apiResposne.context.should.equal("response");
      apiResposne.cacheTestResults.saveResp.should.equal(true);
      done();
    });
  });

  it("can join a room", function(done){
    client.roomAdd('defaultRoom', function(err, data){
      client.roomView('defaultRoom', function(err, data){
        Object.keys( data.data.members ).length.should.equal(1);
        Object.keys( data.data.members )[0].should.equal( client.id );
        done();
      });
    });
  });

  it("can leave a room", function(done){
    client.detailsView(function(err, data){
      data.data.rooms.length.should.equal(0);
      client.roomAdd('defaultRoom', function(err, data){
        client.roomView('defaultRoom', function(err, data){
          Object.keys( data.data.members ).should.containEql( client.id );
          
          client.roomLeave('defaultRoom', function(err, data){
            client.detailsView(function(err, data){
              data.data.rooms.length.should.equal(0);
              done();
            });
          });

        });
      });
    });
  });

  it('will translate bad status to an error callback', function(done){
    client.roomView('someCrazyRoom', function(err, data){
      String(err).should.equal('Error: not member of room someCrazyRoom');
      data.status.should.equal('not member of room someCrazyRoom');
      done();
    });
  });

  it("will get SAY events", function(done){
    var used = false;
    client.roomAdd('defaultRoom', function(){
      client.on("say",function(msgBlock){
        if(used === false){
          used = true;
          msgBlock.message.should.equal("TEST MESSAGE");
          done();
        }
      });

      setup.api.chatRoom.broadcast({}, 'defaultRoom', "TEST MESSAGE");
    });
  });

  it('will obey the servers simultaneousActions policy', function(done){
    client.actionWithParams("sleepTest", {sleepDuration: 500});
    client.actionWithParams("sleepTest", {sleepDuration: 500});
    client.actionWithParams("sleepTest", {sleepDuration: 500});
    client.actionWithParams("sleepTest", {sleepDuration: 500});
    client.actionWithParams("sleepTest", {sleepDuration: 500});
    client.actionWithParams("sleepTest", {sleepDuration: 500}, function(err, apiResposne){
      String(err).should.equal('Error: you have too many pending requests');
      apiResposne.error.should.equal('you have too many pending requests');
      done();
    });
  });

  it("will obey timeouts", function(done){
    client.actionWithParams("sleepTest", {sleepDuration: 2 * 1000}, function(err, apiResposne){
      String( err ).should.equal('Error: Timeout reached');
      should.not.exist(apiResposne);
      done();
    });
  });

});

describe('connection and reconnection', function(){
  // TODO
});
