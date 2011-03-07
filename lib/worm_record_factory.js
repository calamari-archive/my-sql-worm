var WormRecord  = require(__dirname + '/worm_record');

var WormRecordFactory = function(recordName, data, mySqlWorm) {
  data            = data || {};
  this._mySqlWorm = mySqlWorm;

  // process the data
  var RecordBaseClass = function(obj) {
    var tableName = recordName + 's',
        idField   = recordName.substr(0,1).toLowerCase() + recordName.substr(1) + 'Id',
        record    = new WormRecord(tableName, mySqlWorm, idField);

    if (data.structure) {
      var vnr = 1, version;
      while(version = data.structure['version' + vnr]) {
        version.apply(record);
        ++vnr;
      }
    };
    record.initialize(obj);

    return record;
  }
  
  /**
   * Loads a set of records using provided query
   * @param {String} sql The sql query to load the records
   * @param {Array} [params] Some parameters to parse into the ?'s of the sql
   * @param {Function} cb Callback where we load our ressources
   * @returns {WormRecord} One (the first) Record of type WormRecord
   */
  RecordBaseClass.queryOne = function(sql, params, cb) {
    if (!Array.isArray(params)) {
      cb     = params;
      params = [];
    }

    mySqlWorm.query(sql, params, function(err, rows) {
      if (err) {
        cb(err);
      } else {
        if (rows.length) {
          cb(null, new RecordBaseClass(rows[0]));
        } else {
          cb(null, null);
        }
      }
    });
  }

  return RecordBaseClass;
};

module.exports = WormRecordFactory;
