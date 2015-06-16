'use strict';
/**
 * Module dependencies.
 */

var express = require('express'),
    config = require('config');

if(!config.debug){
  require('newrelic');
}
var hoist = require('hoist-core');

hoist.init();
hoist.auth.init(require('passport'));
var routes = require('./app/routes');
var app = express();
require('./config/express')(app);

routes(app);

module.exports = app;
