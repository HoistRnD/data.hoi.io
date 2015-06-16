'use strict';
var auth = require('./auth.js');
var model = require('./model.js');

module.exports = {
	auth: auth(),
	model: model()
};