'use strict';
require('coffee-script');
var controller = require("../controllers/data_controller"),
	passport = require('passport'),
	hoist = require('hoist-core'),
	_ = require('lodash'),
	Store = hoist.data.Store;

var ensureCallAllowed = function(req, res, next) {
	next();
};
var setDataStore = function(req, res, next) {
	req.dataStore = new Store(req.application.dataBucket);
	req.dataStore.setEnvironment(req.environment.token);

	if (req.session && req.session.passport) {
		hoist.utils.logger.log('request headers:',req.headers);
		if (req.headers['x-bucket-key']&&req.session.passport.member&&req.environment) {
			hoist.utils.logger.log('checking for bucket based on header x_bucket_key',req.headers['x-bucket-key']);
			var bucket = _.find(req.environment.buckets,function(bucket){

				return bucket.key.toLowerCase()===req.headers['x-bucket-key'].toLowerCase();
			});

			hoist.utils.logger.log('got bucket: ',bucket.key);
			if(bucket){
				if(_.any(bucket.members,function(bucketMember){
					return bucketMember.memberId.equals(req.session.passport.member._id);
				})){
					req.session.passport.bucket = bucket;
					req.dataStore.setBucket(bucket.key);
				}
			}
		} else if (req.session.passport.bucket) {
			req.dataStore.setBucket(req.session.passport.bucket.key);
		}
	}
	next();
};

module.exports = function(app) {
	app.get('/ping', controller.ping);
	app.post('*', passport.authenticate('hoist'), ensureCallAllowed, setDataStore, controller.post);
	app.put('*', passport.authenticate('hoist'), ensureCallAllowed, setDataStore, controller.post);
	app.get('*', passport.authenticate('hoist'), ensureCallAllowed, setDataStore, controller.get);
	app.delete('*', passport.authenticate('hoist'), ensureCallAllowed, setDataStore, controller.delete);
	app.options('*', function(req, res) {
		res.send("ok");
	});
};
