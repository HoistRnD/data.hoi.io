'use strict';
var fixtures = require('hoist-core/test/fixtures/entities'),
    MongoClient = require('mongodb').MongoClient,
    redis = require('redis'),
    redisClient = redis.createClient(),
    app = require("../../app"),
    _ = require('lodash'),
    request = require('supertest'),
    http = require('http'),
    hoist = require('hoist-core'),
    config = hoist.defaults,
    q = require('hoist-core').q;


describe('get documents', function() {
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
                    db.close(done);
                });
            });
        });
    });
    describe('getting an existing document based on key in url', function() {
        var responseReceived;
        var existing_document = {
            _type: 'model',
            _id: 'key',
            name: 'document name',
            bool: true
        };
        before(function() {
            responseReceived =
                q.ninvoke(db, 'collection', 'default:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', existing_document);
                })
                .then(function() {
                    var r = request(http.createServer(app))
                        .get('/model/key')
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });
        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
        it('will return a response', function() {
            return responseReceived;
        });
        it('will return the correct document', function() {
            return responseReceived.then(function(response) {
                response.body._id.should.eql('key');
                response.body._type.should.eql('model');
                response.body.name.should.eql('document name');
                response.body.bool.should.eql(true);
            });
        });
        it('will return status code to 200', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
    });
    describe('getting an existing document based on key in url scoped to document by origin header', function() {
        var responseReceived;
        var existing_document = {
            _type: 'model',
            _id: 'key',
            name: 'document name in other store',
            bool: true
        };
        before(function() {
            responseReceived =
                q.ninvoke(db, 'collection', 'dev:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', existing_document);
                }).then(function() {
                    var r = request(http.createServer(app))
                        .get('/model/key')
                        .set("Authorization", "Hoist api_key")
                        .set('origin', 'http://sparkle-motion-dev.app.hoi.io');
                    return q.ninvoke(r, 'end');
                });
        });
        after(function(done) {
            db.collection('dev:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
        it('will return a response', function() {
            return responseReceived;
        });
        it('will return the correct document', function() {
            return responseReceived.then(function(response) {
                response.body._id.should.eql('key');
                response.body._type.should.eql('model');
                response.body.name.should.eql('document name in other store');
                response.body.bool.should.eql(true);
            });
        });
        it('will set status code to 200', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
    });

    describe('getting an existing document based on key in url scoped to environment by query string', function() {
        var responseReceived;
        var existing_document = {
            _type: 'model',
            _id: 'key',
            name: 'document name in other store',
            bool: true
        };
        before(function() {
            responseReceived =
                q.ninvoke(db, 'collection', 'other:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', existing_document);
                }).then(function() {
                    var r = request(http.createServer(app))
                        .get('/model/key?overrideEnvironment=other')
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });
        });
        after(function(done) {
            db.collection('other:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
        it('will return a response', function() {
            return responseReceived;
        });
        it('will return the correct document', function() {
            return responseReceived.then(function(response) {
                response.body._id.should.eql('key');
                response.body._type.should.eql('model');
                response.body.name.should.eql('document name in other store');
                response.body.bool.should.eql(true);
            });
        });
        it('will set status code to 200', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
    });
    describe('attempting to get a document that doesn\'t exist', function() {
        var responseReceived;
        before(function() {
            var r = request(http.createServer(app))
                .get('/model/key')
                .set("Authorization", "Hoist api_key");
            responseReceived = q.ninvoke(r, 'end');
        });
        it('will return a response', function() {
            return responseReceived;
        });
        it('will return a 404 status code', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.equal(404);
            });
        });
    });

    describe('getting root model collection', function() {
        var existing_document = {
            x_type: 'model',
            x_id: 'key',
            name: 'document name'
        };
        var existing_document2 = {
            x_type: 'model',
            x_id: 'key2',
            name: 'document name 2'
        };
        var responseReceived;
        before(function() {
            responseReceived = q.ninvoke(db, 'collection', 'default:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', [existing_document, existing_document2]);
                }).then(function() {
                    var r = request(http.createServer(app))
                        .get('/model')
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });

        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
        it('should return ok', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.equal(200);
            });
        });
        it('should return a collection of all items', function() {
            return responseReceived.then(function(response) {
                response.body.length.should.equal(2);
            });
        });
    });

    describe('getting root model collection with no items', function() {
        var responseReceived;
        before(function() {
            var r = request(http.createServer(app))
                .get('/model')
                .set("Authorization", "Hoist api_key");
            responseReceived = q.ninvoke(r, 'end');

        });
        it('should return a 200 status code', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.equal(200);
            });
        });
        it('should return an empty collection of items', function() {
            return responseReceived.then(function(response) {
                response.body.should.be.an.instanceof(Array);
                response.body.length.should.equal(0);
            });
        });
    });
    describe('getting an existing document scoped to bucket by header', function() {
        var responseReceived;
        var existing_document = {
            _type: 'model',
            _id: 'key',
            name: 'document name in other store',
            bool: true
        };
        before(function() {
            responseReceived =
                hoist.models.Application.findOneQ({
                    apiKey: 'api_key'
                }).then(function(application) {
                    var environment = application.environments[0];
                    environment.buckets.push({
                        meta: {

                        },
                        members: [{
                            memberId: environment.members[0]._id,
                            role: 'User'
                        }],
                        owner: environment.members[0]._id,
                        key: 'bucket_key'
                    });
                    return application.saveQ();
                }).then(function() {
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
                            user: fixtures.application._id,
                            member: fixtures.application.environments[0].members[0]
                        }
                    });
                    return q.ninvoke(redisClient, 'set', 'sess:71jm6psbhcDjtitn8lvXlZWA', sessionValue);
                }).then(function() {
                    return q.ninvoke(db, 'collection', 'default:bucket_key:models')
                        .then(function(collection) {
                            return q.ninvoke(collection, 'insert', existing_document);
                        }).then(function() {
                            var r = request(http.createServer(app))
                                .get('/model/key')
                                .set('x-bucket-key', 'bucket_key')
                                .set('cookie', 'hoist-session-api_key=s%3A71jm6psbhcDjtitn8lvXlZWA.LY4Iz1TG7ih66%2BF7D30FYLsXcQPaFldgDGDXq2Q7yTY')
                                .set("Authorization", "Hoist api_key");
                            return q.ninvoke(r, 'end');
                        });
                });

        });
        after(function(done) {
            db.collection('other:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
        it('will return a response', function() {
            return responseReceived;
        });
        it('will return the correct document', function() {
            return responseReceived.then(function(response) {
                response.body._id.should.eql('key');
                response.body._type.should.eql('model');
                response.body.name.should.eql('document name in other store');
                response.body.bool.should.eql(true);
            });
        });
        it('will set status code to 200', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
    });
    describe('getting model collection with limit', function() {
        var existing_document = {
            x_type: 'model',
            x_id: 'key',
            name: 'document name'
        };
        var existing_document2 = {
            x_type: 'model',
            x_id: 'key2',
            name: 'document name 2'
        };
        var existing_document3 = {
            x_type: 'model',
            x_id: 'key3',
            name: 'document name 3'
        };
        var responseReceived;
        before(function() {
            responseReceived = q.ninvoke(db, 'collection', 'default:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', [existing_document, existing_document2, existing_document3]);
                }).then(function() {
                    var r = request(http.createServer(app))
                        .get('/model')
                        .query({
                            limit: 2
                        })
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });

        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
        it('should return ok', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.equal(200);
            });
        });
        it('should return a collection of all items', function() {
            return responseReceived.then(function(response) {
                response.body.length.should.equal(2);
            });
        });
    });
    describe('getting model collection with skip', function() {
        var existing_document = {
            x_type: 'model',
            x_id: 'key',
            name: 'document name'
        };
        var existing_document2 = {
            x_type: 'model',
            x_id: 'key2',
            name: 'document name 2'
        };
        var existing_document3 = {
            x_type: 'model',
            x_id: 'key3',
            name: 'document name 3'
        };
        var responseReceived;
        before(function() {
            responseReceived = q.ninvoke(db, 'collection', 'default:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', [existing_document, existing_document2, existing_document3]);
                }).then(function() {
                    var r = request(http.createServer(app))
                        .get('/model')
                        .query({
                            skip: 2
                        })
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });

        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
        it('should return ok', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.equal(200);
            });
        });
        it('should return a collection of all items', function() {
            return responseReceived.then(function(response) {
                response.body.length.should.equal(1);
            });
        });
    });
    describe('getting model collection with sort', function() {
        var existing_document = {
            x_type: 'model',
            x_id: 'key',
            name: 'document name'
        };
        var existing_document2 = {
            x_type: 'model',
            x_id: 'key2',
            name: 'document name 2'
        };
        var existing_document3 = {
            x_type: 'model',
            x_id: 'key3',
            name: 'document name 3'
        };
        var responseReceived;
        before(function() {
            responseReceived = q.ninvoke(db, 'collection', 'default:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', [existing_document, existing_document2, existing_document3]);
                }).then(function() {
                    var r = request(http.createServer(app))
                        .get('/model')
                        .query({
                            sort: JSON.stringify([
                                ['name', -1]
                            ])
                        })
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });

        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
        it('should return ok', function() {
            return responseReceived.then(function(response) {
                response.statusCode.should.equal(200);
            });
        });
        it('should return a collection of all items in correct order', function() {
            return responseReceived.then(function(response) {
                response.body.length.should.equal(3);
                _.pluck(response.body, 'name').should.eql(["document name 3",
                    "document name 2",
                    "document name"
                ]);
            });
        });
    });
});