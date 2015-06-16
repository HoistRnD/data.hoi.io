'use strict';
var hoist = require('hoist-core'),
  config = hoist.defaults,
  Organisation = hoist.models.Organisation,
  Application = hoist.models.Application,
  DataRuleCollection = hoist.models.DataRuleCollection,
  MongoClient = require('mongodb').MongoClient,
  User = hoist.models.User,
  q = require('hoist-core').q,
  http = require('http'),
  request = require('supertest'),
  redis = require('redis'),
  redisClient = redis.createClient(),
  app = require("../../app");

describe('Data Rules', function () {
  this.timeout(3000);
  var drC = new DataRuleCollection();
  var rule1 = drC.rules.create({
    rule: 'return !!(model.name);',
    name: 'Rule 1',
    enabled: true
  });
  var rule2 = drC.rules.create({
    rule: 'return !!(!existing||model.name===existing.name);',
    name: 'Rule 2',
    enabled: true
  });
  var rule3 = drC.rules.create({
    rule: 'return !!((!user) || (user.name===\'someUser\'&&user.email===\'test@hoi.io\'&&user.role===\'Admin\'&&model.user===user.name));',
    name: 'Rule 3',
    enabled: true
  });
  var disabledRule = drC.rules.create({
    rule: 'return false;',
    name: 'Rule disabled',
    enabled: false
  });
  var dataRuleCollectionData = {
    rules: [rule1, rule2, rule3, disabledRule]
  };

  var createApplication = function () {
    return new Organisation().saveQ().then(function (org) {
      return new Application({
        ownerOrganisation: org._id,
        dataBucket: 'test_account',
        environments: [{
          name: '_default',
          token: 'default',
          isDefault: true
        }]
      }).saveQ();
    }).then(function (application) {
      return new User({
        name: 'someUser',
        emailAddresses: [{
          address: 'test@hoi.io'
        }]
      }).saveQ().then(function (user) {
        var dataRuleCollection = new DataRuleCollection(dataRuleCollectionData);
        dataRuleCollection.application = application._id;
        dataRuleCollection.runLists = [{
          model: 'ALL',
          onUpdate: [rule1._id, rule2._id, rule3._id, disabledRule._id]
        }];
        return dataRuleCollection.saveQ().then(function (dataRuleCollection) {
          application.environments[0].dataRules = dataRuleCollection._id;
          application.environments[0].members.push({
            userId: user._id,
            defaultRole: 'Admin'
          });
          return application.saveQ();
        });
      });

    });
  };
  var _mongoConnection;
  before(function (done) {
    Application.remove({}, function () {
      DataRuleCollection.remove({}, function () {
        Organisation.remove({}, function () {
          User.remove({}, function () {
            MongoClient.connect(config.mongo.db, function (err, connection) {
              if (err) {
                throw err;
              }
              _mongoConnection = connection;
              done();
            });
          });
        });
      });
    });
  });
  afterEach(function (done) {
    Application.remove({}, function () {
      DataRuleCollection.remove({}, function () {
        Organisation.remove({}, function () {
          User.remove({}, done);
        });
      });
    });
  });
  after(function (done) {

    var db = _mongoConnection.db('test_account');
    db.dropDatabase(function () {
      _mongoConnection.close(done);
    });

  });
  describe('posting a new model that passes the data rules', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {

        var r = request(http.createServer(app))
          .post('/model')
          .send({
            name: 'this model has a name',
          })
          .set("Authorization", "Hoist " + application.apiKey);
        return q.ninvoke(r, 'end');
      });
    });
    it('should return a 200 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(200);
      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });
  });
  describe('posting an update to a model that passes the data rules', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {
        var r = request(http.createServer(app))
          .post('/model')
          .send({
            name: 'this model has a name',
          })
          .set("Authorization", "Hoist " + application.apiKey);
        return q.ninvoke(r, 'end');
      });
    });
    it('should return a 200 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(200);
      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });
  });
  describe('posting a single model that fails the data rules', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {
        var r = request(http.createServer(app))
          .post('/model')
          .send({

          })
          .set("Authorization", "Hoist " + application.apiKey);
        return q.ninvoke(r, 'end');
      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });

    it('should return a 403 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(403);
      });
    });
    it('should explain that validation rules failed', function () {
      return responseReceived.then(function (response) {
        response.body.message.should.eql("One or more data rules failed");
        response.body.failures[0].rule.should.eql("Rule 1");
      });
    });
  });
  describe('posting an update to a model that fails the data rules', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {
        var db = _mongoConnection.db('test_account');
        return q.ninvoke(db, 'collection', 'default:default:models')
          .then(function (collection) {
            return q.ninvoke(collection, 'insert', {
                name: 'oldname',
                _type: 'model',
                _id: '1'
              })
              .then(function () {
                var r = request(http.createServer(app))
                  .post('/model/1?force=true')
                  .send({
                    name: 'newname'
                  })
                  .set("Authorization", "Hoist " + application.apiKey);
                return q.ninvoke(r, 'end');
              });
          });
      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });
    it('should return a 403 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(403);
      });
    });
    it('should explain that validation rules failed', function () {
      return responseReceived.then(function (response) {
        response.body.message.should.eql("One or more data rules failed");
        response.body.failures[0].rule.should.eql("Rule 2");
      });
    });
    it('should not update data', function () {
      return responseReceived.then(function () {
        var db = _mongoConnection.db('test_account');
        return q.ninvoke(db, 'collection', 'default:default:models').then(function (collection) {
          return q.ninvoke(collection.find(), 'toArray');
        });
      }).then(function (documents) {
        var doc = documents[0];
        doc.name.should.eql('oldname');
      });
    });
  });
  describe('posting a collection of new models that passes the data rules', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {
        var r = request(http.createServer(app))
          .post('/model')
          .send([{
            name: 'name 1'
          }, {
            name: 'name 2'
          }])
          .set("Authorization", "Hoist " + application.apiKey);
        return q.ninvoke(r, 'end');

      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });
    it('should return a 200 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(200);
      });
    });
  });
  describe('posting a collection of existing models that passes the data rules', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {
        var db = _mongoConnection.db('test_account');
        return q.ninvoke(db, 'collection', 'default:default:models')
          .then(function (collection) {
            return q.ninvoke(collection, 'insert', {
                name: 'oldname1',
                _type: 'model',
                _id: '1'
              }).then(function () {
                return q.ninvoke(collection, 'insert', {
                  name: 'oldname2',
                  _type: 'model',
                  _id: '2'
                });
              })
              .then(function () {

                var r = request(http.createServer(app))
                  .post('/model')
                  .send([{
                    _id: 1,
                    name: 'oldname1'
                  }, {
                    _id: 2,
                    name: 'oldname2'
                  }])
                  .set("Authorization", "Hoist " + application.apiKey);
                return q.ninvoke(r, 'end');
              });
          });
      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });
    it('should return a 200 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(200);
      });
    });
  });
  describe('posting a collection of new models that fails the data rules', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {
        hoist.logger.debug('making request \'posting a collection of new models that fails the data rules\'');
        var r = request(http.createServer(app))
          .post('/model')
          .send([{
            name: 'newname'
          }, {
            something: 'true'
          }, {
            else :'me'
          }])
          .set("Authorization", "Hoist " + application.apiKey);
        return q.ninvoke(r, 'end');
      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });
    it('should return a 403 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(403);
      });
    });
    it('should explain that validation rules failed', function () {
      return responseReceived.then(function (response) {
        hoist.logger.debug('response recieved', JSON.stringify(response.body));
        response.body.message.should.eql("One or more data rules failed");
        response.body.failures[0].rule.should.eql("Rule 1");
        response.body.failures[1].rule.should.eql("Rule 1");
      });
    });
  });
  describe('posting a collection of existing models that fails the data rules', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {
        var db = _mongoConnection.db('test_account');
        return q.ninvoke(db, 'collection', 'default:default:models')
          .then(function (collection) {
            return q.ninvoke(collection, 'insert', {
              name: 'oldname',
              _type: 'model',
              _id: '1'
            }).then(function () {
              var r = request(http.createServer(app))
                .post('/model')
                .send([{
                  name: 'newname',
                  _id: '1',
                }, {
                  name: 'newdoc'
                }])
                .set("Authorization", "Hoist " + application.apiKey);
              return q.ninvoke(r, 'end');
            });
          });

      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });
    it('should return a 403 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(403);
      });
    });
    it('should explain that validation rules failed', function () {
      return responseReceived.then(function (response) {
        response.body.message.should.eql("One or more data rules failed");
        response.body.failures[0].rule.should.eql("Rule 2");
      });
    });
  });
  describe('posting an update to a model that fails based on user account', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {
        redisClient.select(10);
        var sessionValue = JSON.stringify({
          cookie: {
            originalMaxAge: null,
            expires: null,
            httpOnly: true,
            domain: "",
            path: ""
          },
          passport: {
            user: application._id,
            member: application.environments[0].members[0].toObject()
          }
        });
        return q.ninvoke(redisClient, 'set', 'sess:71jm6psbhcDjtitn8lvXlZWA', sessionValue)
          .then(function () {
            var r = request(http.createServer(app))
              .post('/model')
              .send({
                name: 'newname ',
                user: 'someOtherUser '
              })
              .set('cookie', 'hoist-session-' + application.apiKey.toLowerCase() + '=s%3A71jm6psbhcDjtitn8lvXlZWA.LY4Iz1TG7ih66%2BF7D30FYLsXcQPaFldgDGDXq2Q7yTY')
              .set("Authorization", "Hoist " + application.apiKey);
            return q.ninvoke(r, 'end');
          });


      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });
    it('should return a 403 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(403);
      });
    });
    it('should explain that validation rules failed', function () {
      return responseReceived.then(function (response) {
        response.body.message.should.eql("One or more data rules failed");
        response.body.failures[0].rule.should.eql("Rule 3");
      });
    });
  });
  describe('posting an update to a model that passes based on user account', function () {
    var responseReceived;
    before(function () {
      responseReceived = createApplication().then(function (application) {
        redisClient.select(10);
        var sessionValue = JSON.stringify({
          cookie: {
            originalMaxAge: null,
            expires: null,
            httpOnly: true,
            domain: "",
            path: ""
          },
          passport: {
            user: application._id,
            member: application.environments[0].members[0].toObject()
          }
        });
        return q.ninvoke(redisClient, 'set', 'sess:71jm6psbhcDjtitn8lvXlZWA', sessionValue)
          .then(function () {
            var r = request(http.createServer(app))
              .post('/model')
              .send({
                name: 'newname',
                user: 'someUser'
              })
              .set('cookie', 'hoist-session-' + application.apiKey.toLowerCase() + '=s%3A71jm6psbhcDjtitn8lvXlZWA.LY4Iz1TG7ih66%2BF7D30FYLsXcQPaFldgDGDXq2Q7yTY')
              .set("Authorization", "Hoist " + application.apiKey);
            return q.ninvoke(r, 'end');
          });
      });
    });
    after(function (done) {
      var db = _mongoConnection.db('test_account');
      db.collection('default:default:models', function (err, collection) {
        collection.remove(done);
      });
    });
    it('should return a 200 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(200);
      });
    });
  });

});
