'use strict';
var hoist = require('hoist-core'),
    fixtures = require('hoist-core/test/fixtures/entities'),
    config = hoist.defaults,
    MongoClient = require('mongodb').MongoClient,
    q = require('hoist-core').q,
    should = require('chai').should(),
    http = require('http'),
    request = require('supertest'),
    app = require("../../app");

describe('POST a simple document', function() {
    var db;
    before(function(done) {
        var saveEntities = [
            new hoist.models.Organisation(fixtures.organisation).saveQ(),
            new hoist.models.Application(fixtures.application).saveQ()
        ];
        q.allSettled(saveEntities).then(function() {
            MongoClient.connect(config.mongo.db, function(err, connection) {
                if (err) {
                    throw err;
                }
                db = connection.db('test-db');
                done();
            });
        }).done();
    });
    after(function(done) {
        hoist.models.Application.remove({}, function() {
            hoist.models.Organisation.remove({}, function() {
                db.dropDatabase(function() {
                    db.close(function() {
                        done();
                    });
                });
            });
        });
    });
    describe('posting a new document specifying id in url', function() {
        var postedBody = {
            "name": "hi",
            "boolVal": true,
            "intVal": 123
        };
        var responseReceived;
        before(function() {
            var r = request(http.createServer(app))
                .post('/model/key')
                .send(postedBody)
                .set("Authorization", "Hoist api_key");
            responseReceived = q.ninvoke(r, 'end');
        });
        it('should return a 200 response', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
        it('should create a document in mongo', function() {
            return responseReceived.then(function() {
                return q.ninvoke(db, 'collection', 'default:default:models')
                    .then(function(collection) {
                        return q.ninvoke(collection.find(), 'toArray');
                    });
            }).then(function(items) {
                items.length.should.eql(1);
            });
        });
        it('should return the saved object', function() {
            return responseReceived.then(function(response) {
                should.exist(response.body._createdDate);
            });
        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
    });
    describe('posting a new document without specifying id in url', function() {
        var postedBody = {
            "name": "hi",
            "boolVal": true,
            "intVal": 123
        };
        var responseReceived;
        before(function() {
            var r = request(http.createServer(app))
                .post('/model')
                .send(postedBody)
                .set("Authorization", "Hoist api_key");
            responseReceived = q.ninvoke(r, 'end');
        });
        it('should return a 200 response', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
        it('should return the saved object', function() {
            return responseReceived.then(function(response) {
                should.exist(response.body._createdDate);
            });
        });
        it('should create an object in mongo', function() {
            return responseReceived.then(function() {
                return q.ninvoke(db, 'collection', 'default:default:models')
                    .then(function(collection) {
                        return q.ninvoke(collection.find(), 'toArray');
                    });
            }).then(function(items) {
                items.length.should.eql(1);
            });
        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
    });
    describe('posting a batch of new documents without specifying id in url', function() {
        var postedBody = [{
            "name": "hi",
            "boolVal": true,
            "intVal": 123
        }, {
            "name": "hi2",
            "boolVal": false,
            "intVal": 123
        }];
        var responseReceived;
        before(function() {
            var r = request(http.createServer(app))
                .post('/model')
                .send(postedBody)
                .set("Authorization", "Hoist api_key");
            responseReceived = q.ninvoke(r, 'end');
        });
        it('should return a 200 response', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
        it('should create objects in couch', function() {
					return responseReceived.then(function() {
							return q.ninvoke(db, 'collection', 'default:default:models')
									.then(function(collection) {
											return q.ninvoke(collection.find(), 'toArray');
									});
					}).then(function(items) {
							items.length.should.eql(2);
					});
				});
        it('should return the saved objects', function() {
					return responseReceived.then(function(response) {
						response.body.should.be.an.instanceof(Array);
						response.body.length.should.eql(2);
						should.exist(response.body[0]._createdDate);
						should.exist(response.body[1]._createdDate);
					});
				});
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
    });

});
