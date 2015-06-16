'use strict';
var requestParser = require('../../app/platform/request_parser');
var should = require('chai').should();
describe('request parsing', function() {
  describe('parsing a GET request with type, id specified', function() {
    var req;
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'GET',
        url: 'http://data.hoi.io/modelname/key_value',
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, null, next);
    });
    it('should populate dataParams on request', function() {
      req.dataParams._type.should.eql('modelname');
      req.dataParams._id.should.eql('key_value');
    });
    it('should call next', function() {
      nextCalled.should.eql(1);
    });
  });
  describe('parsing a GET request with only type', function() {
    var req;
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'GET',
        url: 'http://data.hoi.io/modelname',
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, null, next);
    });
    it('should populate dataParams on request', function() {
      req.dataParams._type.should.eql('modelname');
      should.not.exist(req.dataParams._id);
    });
    it('should call next', function() {
      nextCalled.should.eql(1);
    });
  });
  describe('parsing a GET request with no type', function() {
    var req;
    var response = {};
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'GET',
        url: 'http://data.hoi.io/',
      };
      var res = {
        send: function(statusCode, data) {
          response.statusCode = statusCode;
          response.body = data;
        }
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, res, next);
    });
    it('should not populate dataParams on request', function() {
      should.not.exist(req.dataParams);
    });
    it('should not call next', function() {
      nextCalled.should.eql(0);
    });
    it('should return a 400 status code', function() {
      response.statusCode.should.eql(400);
    });
    it('should return a message saying type is required', function() {
      response.body.message.should.eql('url must contain a model name');
    });
  });
  describe('parsing a POST request with type, id specified, but no body', function() {
    var req;
    var response = {};
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'POST',
        url: 'http://data.hoi.io/modelname/key_value',
        is: function() {
          return true;
        }
      };
      var res = {
        send: function(statusCode, data) {
          response.statusCode = statusCode;
          response.body = data;
        }
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, res, next);
    });
    it('should populate dataParams on request', function() {
      req.dataParams._type.should.eql('modelname');
      req.dataParams._id.should.eql('key_value');
    });
    it('should return a 400 status code', function() {
      response.statusCode.should.eql(400);
    });
    it('should return a message saying type is required', function() {
      response.body.message.should.eql('no data was sent with the request');
    });
    it('should not call next', function() {
      nextCalled.should.eql(0);
    });
  });
  describe('parsing a POST request with a non json content type', function() {
    var req;
    var response = {};
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'POST',
        url: 'http://data.hoi.io/modelname/key_value',
        is: function() {
          return false;
        }
      };
      var res = {
        send: function(statusCode, data) {
          response.statusCode = statusCode;
          response.body = data;
        }
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, res, next);
    });
    it('should populate dataParams on request', function() {
      req.dataParams._type.should.eql('modelname');
      req.dataParams._id.should.eql('key_value');
    });
    it('should return a 400 status code', function() {
      response.statusCode.should.eql(400);
    });
    it('should return a message saying type is required', function() {
      response.body.message.should.eql('Content type must be set to application/json');
    });
    it('should not call next', function() {
      nextCalled.should.eql(0);
    });
  });
  describe('parsing a POST request with a single entity, to just a type url', function() {
    var req;
    var response = {};
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'POST',
        url: 'http://data.hoi.io/modelname',
        is: function() {
          return true;
        },
        body: {
          name: 'hi'
        }
      };
      var res = {
        send: function(statusCode, data) {
          response.statusCode = statusCode;
          response.body = data;
        }
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, res, next);
    });

    it('should call next', function() {
      nextCalled.should.eql(1);
    });
    it('should populate request entities', function() {
      req.boundData.entities.length.should.eql(1);
    });
    it('should populate type on entities', function() {
      req.boundData.entities[0]._type.should.eql('modelname');
    });
  });
  describe('parsing a POST request with multiple entities, to just a typed url', function() {
    var req;
    var response = {};
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'POST',
        url: 'http://data.hoi.io/modelname',
        is: function() {
          return true;
        },
        body: [{
          name: 'hi'
        }, {
          name: 'boo',
          _type: 'fish'
        }]
      };
      var res = {
        send: function(statusCode, data) {
          response.statusCode = statusCode;
          response.body = data;
        }
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, res, next);
    });

    it('should call next', function() {
      nextCalled.should.eql(1);
    });
    it('should populate request entities', function() {
      req.boundData.entities.length.should.eql(2);
    });
    it('should override type on entities', function() {
      req.boundData.entities[0]._type.should.eql('modelname');
      req.boundData.entities[1]._type.should.eql('modelname');
    });
  });
  describe('parsing a POST request with multiple entities, to and id url', function() {
    var req;
    var response = {};
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'POST',
        url: 'http://data.hoi.io/modelname/key',
        is: function() {
          return true;
        },
        body: [{
          name: 'hi'
        }, {
          name: 'boo',
          _type: 'fish'
        }]
      };
      var res = {
        send: function(statusCode, data) {
          response.statusCode = statusCode;
          response.body = data;
        }
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, res, next);
    });

    it('should not call next', function() {
      nextCalled.should.eql(0);
    });
    it('should return a 400 response', function() {
      response.statusCode.should.eql(400);
    });
  });
  describe('parsing a POST request with single entity, to type and id url', function() {
    var req;
    var response = {};
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'POST',
        url: 'http://data.hoi.io/modelname/key',
        is: function() {
          return true;
        },
        body: {
          name: 'hi'
        }
      };
      var res = {
        send: function(statusCode, data) {
          response.statusCode = statusCode;
          response.body = data;
        }
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, res, next);
    });

    it('should call next', function() {
      nextCalled.should.eql(1);
    });
    it('should populate entity', function() {
      req.boundData.entities.length.should.eql(1);
    });
    it('should set entity type and id', function() {
      req.boundData.entities[0]._type.should.eql('modelname');
      req.boundData.entities[0]._id.should.eql('key');
    });
  });
  describe('parsing a POST request with single entity, to type url', function() {
    var req;
    var response = {};
    var nextCalled = 0;
    var requestParsed;
    before(function() {
      req = {
        method: 'POST',
        url: 'http://data.hoi.io/modelname',
        is: function() {
          return true;
        },
        body: {
          name: 'hi'
        }
      };
      var res = {
        send: function(statusCode, data) {
          response.statusCode = statusCode;
          response.body = data;
        }
      };
      var next = function() {
        nextCalled++;
      };
      requestParsed = requestParser.parseRequest(req, res, next);
    });

    it('should call next', function() {
      nextCalled.should.eql(1);
    });
    it('should populate entity', function() {
      req.boundData.entities.length.should.eql(1);
    });
    it('should set entity type and id', function() {
      req.boundData.entities[0]._type.should.eql('modelname');
    });
  });

});