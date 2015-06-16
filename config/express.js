'use strict';
var express = require('express'),
  passport = require('passport'),
  hoist = require('hoist-core'),
  requestParser = require('../app/platform/request_parser');
var allowCrossDomain = function(req, res, next) {
  if (req.headers['origin'] && req.headers['origin'] != 'null') {
    res.header('Access-Control-Allow-Origin', req.headers['origin']);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', "*");
  }
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  var allowHeaders = 'Content-Type, authorize';
  if (req.headers['access-control-request-headers']) {
    allowHeaders = req.headers['access-control-request-headers'];
  }
  res.header('Access-Control-Allow-Headers', allowHeaders);
  res.header('Access-Control-Max-Age',3000);

  next();
};
module.exports = function(app) {
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(hoist.session());
  app.use(passport.initialize({
    userProperty: 'application'
  }));
  app.use(passport.session());
  app.use(requestParser.parseRequest);
  app.use(allowCrossDomain);
  app.use(hoist.middleware.logging);
  app.use(app.router);

  app.use(function(err, req, res, next) {
    if (err) {
      hoist.utils.logger.log('error', 'request produced an error', err.stack);
    }
    next();
  });
  app.use(hoist.middleware.errorHandler);

};
