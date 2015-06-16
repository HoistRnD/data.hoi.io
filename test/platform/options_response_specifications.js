'use strict';
var request = require('supertest'),
    http = require('http'),
    app = require("../../app"),
    q = require('hoist-core').q;
describe('requesting GET options', function() {
    var _responseReceived;
    before(function() {

        var r = request(http.createServer(app))
            .options('/auth')
            .set('Access-Control-Request-Headers', 'x-sso-data-hoi-io, authorize')
            .set('Access-Control-Request-Method', 'GET')
            .set('Origin', 'http://localhost:8080')
            .set('Referer', 'http://localhost:8080/playhoist/');

        /*
            Access-Control-Request-Headers:accept, x-sso-data-hoi-io
Access-Control-Request-Method:GET
Connection:keep-alive
Host:data.hoi.io
Origin:http://localhost:8080
Referer:http://localhost:8080/playhoist/
*/

        _responseReceived = q.ninvoke(r, "end");

    });
    it('return ok response', function() {
        return _responseReceived.then(function(response) {
            response.statusCode.should.equal(200);
        });


    });
    it('should return Access-Control-Allow-Origin matching request origin', function() {
        return _responseReceived.then(function(response) {
            response.headers['access-control-allow-origin'].should.equal('http://localhost:8080');
        });
    });
    it('should return Access-Control-Allow-Credentials header', function() {
        return _responseReceived.then(function(response) {
            response.headers['access-control-allow-credentials'].should.equal('true');
        });
    });
    it('should return Access-Control-Allow-Headers', function() {
        return _responseReceived.then(function(response) {
            response.headers['access-control-allow-headers'].should.equal('x-sso-data-hoi-io, authorize');
        });
    });


});