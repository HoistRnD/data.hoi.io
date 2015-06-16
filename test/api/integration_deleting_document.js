'use strict';
var fixtures = require('hoist-core/test/fixtures/entities'),
    hoist = require('hoist-core'),
    config = require('hoist-core').defaults,
    MongoClient = require('mongodb').MongoClient,
    app = require("../../app"),
    request = require('supertest'),
    http = require('http'),
    q = require('hoist-core').q;

describe('DELETE /model/<key>', function() {
    var db;
    before(function(done) {
        var saveEntities = [
            new hoist.models.Organisation(fixtures.organisation).saveQ(),
            new hoist.models.Application(fixtures.application).saveQ()
        ];

        q.all(saveEntities).spread(function(org, app) {
            var roleCollection = hoist.models.RoleCollection.createNew();
            roleCollection.anonClaims.push('delete-data');
            return roleCollection.saveQ().then(function(roleCollection) {
                app.environments[0].availableRoles = roleCollection;
                return app.saveQ();
            });
        }).then(function() {
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
        hoist.models.RoleCollection.remove({}, function() {
            hoist.models.Application.remove({}, function() {
                hoist.models.Organisation.remove({}, function() {
                    db.dropDatabase(function() {
                        db.close(done);
                    });
                });
            });
        });
    });
    describe('when model/key exists in database', function() {
        var requestMade;
        before(function() {
            requestMade =
                q.ninvoke(db, 'collection', 'default:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', {
                        _id: 'key',
                        _type: 'model',
                        name: 'name'
                    });
                })
                .then(function() {
                    var r = request(http.createServer(app))
                        .del('/model/key')
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });

        });
        it('will return a 200 response', function() {
            return requestMade.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
        it('will remove document from database', function() {
            return requestMade.then(function() {
                return q.ninvoke(db, 'collection', 'default:default:models')
                    .then(function(collection) {
                        return q.ninvoke(collection.find(), 'toArray');
                    });
            }).then(function(items) {
                items.length.should.eql(0);
            });
        });
        it('will respond with number of documents removed', function() {
            return requestMade.then(function(response) {
                response.body.status.should.eql('ok');
                response.body.removed.should.eql(1);
            });
        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
    });
    describe('when document doesnt exists', function() {
        var requestMade;
        before(function() {
            requestMade =
                q.ninvoke(db, 'collection', 'default:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', {
                        _id: 'key',
                        _type: 'model',
                        name: 'name'
                    });
                })
                .then(function() {
                    var r = request(http.createServer(app))
                        .del('/model/nothing')
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });

        });
        it('will return a 200 response', function() {
            return requestMade.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
        it('will respond with number of documents removed (0)', function() {
            return requestMade.then(function(response) {
                response.body.status.should.eql('ok');
                response.body.removed.should.eql(0);
            });
        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
    });
    describe('deleting collection', function() {
        var requestMade;
        before(function() {
            requestMade =
                q.ninvoke(db, 'collection', 'default:default:models')
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', {
                        _id: 'key',
                        _type: 'model',
                        name: 'name'
                    }).then(function() {
                        return q.ninvoke(collection, 'insert', {
                            _id: 'key2',
                            _type: 'model',
                            name: 'othername'
                        });
                    });
                })
                .then(function() {
                    var r = request(http.createServer(app))
                        .del('/model')
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });

        });
        it('will return a 200 response', function() {
            return requestMade.then(function(response) {
                response.statusCode.should.eql(200);
            });
        });
        it('will respond with number of documents removed', function() {
            return requestMade.then(function(response) {
                response.body.status.should.eql('ok');
                response.body.removed.should.eql(2);
            });
        });
        after(function(done) {
            db.collection('default:default:models', function(err, collection) {
                collection.remove(done);
            });
        });
    });
    describe('when user doesn\'t have delete rights', function() {
        var requestMade;
        before(function() {
            requestMade =
                hoist.models.RoleCollection.findOneQ({})
                .then(function(roleCollection) {
                    roleCollection.anonClaims = ['read-data', 'write-data'];
                    return roleCollection.saveQ();
                })
                .then(function() {
                    return q.ninvoke(db, 'collection', 'default:default:models');
                })
                .then(function(collection) {
                    return q.ninvoke(collection, 'insert', {
                        _id: 'key',
                        _type: 'model',
                        name: 'name'
                    });
                })
                .then(function() {
                    var r = request(http.createServer(app))
                        .del('/model/key')
                        .set("Authorization", "Hoist api_key");
                    return q.ninvoke(r, 'end');
                });

        });
        it('will return a Forbidden (403) response', function() {
            return requestMade.then(function(response) {
                response.statusCode.should.eql(403);
            });
        });
        it('will not remove document from database', function() {
            return requestMade.then(function() {
                return q.ninvoke(db, 'collection', 'default:default:models')
                    .then(function(collection) {
                        return q.ninvoke(collection.find(), 'toArray');
                    });
            }).then(function(items) {
                items.length.should.eql(1);
            });
        });
        after(function(done) {
            hoist.models.RoleCollection.findOne({}, function(err, roleCollection) {
                roleCollection.anonClaims = ['read-data', 'write-data', 'delete-data'];
                return roleCollection.save(function() {
                    db.collection('default:default:models', function(err, collection) {
                        collection.remove(done);
                    });
                });

            });
        });
    });
});