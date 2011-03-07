
// requires
var WormRecord  = require(__dirname + '/worm_record')
,   WormFactory = require(__dirname + '/worm_record_factory')
,   errors      = require(__dirname + '/worm_errors')
,   Worm        = require(__dirname + '/worm')

,   MySqlClient = require('../deps/mysql').Client
;

/**
 * Base class for starting up the MySQL connection
 * This object let you define your WormRecords, with migrations, getter,
 * setter and more cool stuff
 * @param {Object} options Important options like connection options
 * @param {Object} options.connection Contains: user, password, database, host & port
 * @returns {WormRecord}
 */
var MySQLWorm = function(options) {
	if (!options) throw new errors.MissingArgumentsError('Called MySQLWorm without providing options.');
	if (!options.connection) throw new errors.MissingArgumentsError('Called MySQLWorm without providing options for the connection.');
  
  this._client = MySqlClient(options.connection);
  this._models = {};
};

MySQLWorm.prototype.__defineGetter__('isConnected', function() {
  return this._client.connected;
});

MySQLWorm.prototype.connect = function(cb) {
  var self = this;
  this._client.connect(cb);
};

MySQLWorm.prototype.disconnect = function(cb) {
  var self = this;
  if (this._client.connected) {
    this._client.end(cb);
  } else {
    cb(null);
  }
};

MySQLWorm.prototype.define = function(name, data) {
  this._models[name] = new WormFactory(name, data, this);
  return this._models[name];
};

MySQLWorm.prototype.getModel = function(name) {
  return this._models[name] || null;
};

/**
 * Connects if not conected and if finally connected calls callback
 */
MySQLWorm.prototype._doReconnect = function(cb) {
  if (this._client.connected) {
    cb();
  } else {
    this.connect(cb);
  }
};

MySQLWorm.prototype.query = function(query, params, cb) {
  var self = this;
  this._doReconnect(function(err) {
    if (err) {
      db(err);
    } else {
      self._client.query(query, params, cb);
    }
  });
};

MySQLWorm.STRING   = 'VARCHAR(255)';
MySQLWorm.TEXT     = 'TEXT';
MySQLWorm.INT      = 'INT(11)';
MySQLWorm.FLOAT    = 'FLOAT';
MySQLWorm.BOOLEAN  = 'TINYINT(1)';
MySQLWorm.DATETIME = 'DATETIME';

module.exports = MySQLWorm;
