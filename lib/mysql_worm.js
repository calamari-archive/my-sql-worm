
// requires
var WormRecord  = require(__dirname + '/worm_record')
,   errors      = require(__dirname + '/worm_errors')

,   MySqlClient = require('../deps/mysql').Client
;

/**
 * Base class for starting up the MySQL connection
 * @param {Object} options Important options like connection options
 * @param {Object} options.connection Contains: user, password, database, host & port
 * @returns {WormRecord}
 */
var MySQLWorm = function(options) {
	if (!options) throw new errors.MissingArgumentsError('Called MySQLWorm without providing options.');
	if (!options.connection) throw new errors.MissingArgumentsError('Called MySQLWorm without providing options for the connection.');
  
  this._client = MySqlClient(options.connection);
};

MySQLWorm.prototype.__defineGetter__('isConnected', function() {
  return this._isConnected;
});

MySQLWorm.prototype.connect = function(cb) {
  var self = this;
  this._client.connect(function(err) {
    if (err) throw err;
    
    self._isConnected = true;
    cb();
  });
};

MySQLWorm.prototype.disconnect = function(cb) {
  var self = this;
  this._client.end(function(err) {
    if (err) throw err;

    self._isConnected = false;
    cb();
  });
}


module.exports = MySQLWorm;
