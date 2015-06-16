'use strict';
var errors = require('custom-errors'),
    extend = require('extend');

errors = extend(errors, {
    Data: {
        RulesFailed: errors.Factory('Data Rules failed', 6, 403, true),
        SaveFailed: errors.Factory('Saving Entity Failed', 6, 403, true)
    },
});

module.exports = errors;
