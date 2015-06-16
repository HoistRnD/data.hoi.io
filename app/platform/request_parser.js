var hoist = require('hoist-core'),
    binder = hoist.data.binder,
    errors = require('../platform/errors'),
    q = require('hoist-core').q,
    url = require('url'),
    _ = require('underscore'),
    extend = require('extend');

var ModelPostRequestParser = function() {

    this.getRequestParams = function(req) {
        var params = {};
        var pathname = url.parse(req.url).pathname;
        var path = pathname.slice(1, pathname.length);
        var pathComponents = path.split('/');
        if (pathComponents.length < 1 || pathComponents[0].length === 0) {
            throw new errors.request.BadRequest("url must contain a model name");
        } else if (pathComponents[0].indexOf(':') !== -1) {
            throw new errors.request.BadRequest("model names cannot contain : characters");
        } else {
            params._type = pathComponents[0];
        }
        if (pathComponents.length > 1) {
            params._id = pathComponents[1];
        }
        return params;
    };

};
var self;

ModelPostRequestParser.prototype = {

    parseRequest: function(req, res, next) {
        q.fcall(function() {
            req.dataParams = self.getRequestParams(req);
            if (req.method === 'GET'||req.method==='DELETE') {
                return next();
            }
            if (req.method !== 'POST' && req.method !== 'PUT') {
                return next();
            }
            if (!req.is('json')) {
                throw new errors.request.BadRequest('Content type must be set to application/json');
            }
            if (!req.body) {
                throw new errors.request.BadRequest('no data was sent with the request');
            }
            var rawData = _.map([].concat(req.body), function(entity) {
                    return extend(entity, req.dataParams);
            });
            if (req.dataParams._id && rawData.length > 1) {
                throw new errors.request.BadRequest('posting multiple entities to an id is not allowed');
            }
            return binder.bind(rawData).then(function(response) {
                req.boundData = response;
                next();
            });
        }).fail(function(err) {         
            if (!err.resCode) {
                hoist.error(err,req,req.application);
            } else {
                res.send(err.resCode||500, {
                    'message': err.message||'oops something went wrong'
                });
            }
        }).done();
    }

};


module.exports = (self = new ModelPostRequestParser());