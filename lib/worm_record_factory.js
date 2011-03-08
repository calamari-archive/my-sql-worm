var WormRecord  = require(__dirname + '/worm_record');

var WormRecordFactory = function(recordName, data, mySqlWorm) {
  data            = data || {};
  this._mySqlWorm = mySqlWorm;
  var tableName = recordName + 's';

  // process the data
  var RecordBaseClass = function(obj) {
    var idField   = recordName.substr(0,1).toLowerCase() + recordName.substr(1) + 'Id',
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
   * Does the query for queryAll and queryOne
   */
  function doQuery(args, internCallback) {
    var sql    = args[0],
        params = args[1],
        cb     = args[2] || null;

    if (!Array.isArray(params)) {
      cb     = params;
      params = [];
    }

    mySqlWorm.query(sql, params, function(err, rows) {
      if (err) {
        cb(err);
      } else {
        internCallback(rows, cb);
      }
    });
  }

  /**
   * Loads a one record using provided query
   * @param {String} sql The sql query to load the records
   * @param {Array} [params] Some parameters to parse into the ?'s of the sql
   * @param {Function} cb Callback where we load our ressources
   * @returns {WormRecord} One (the first) Record of type WormRecord
   */
  RecordBaseClass.queryOne = function(sql, params, cb) {
    doQuery(arguments, function(rows, cb) {
      if (rows.length) {
        cb(null, new RecordBaseClass(rows[0]));
      } else {
        cb(null, null);
      }
    });
  }

  /**
   * Loads a set of records using provided query
   * @param {String} sql The sql query to load the records
   * @param {Array} [params] Some parameters to parse into the ?'s of the sql
   * @param {Function} cb Callback where we load our ressources
   * @returns {Array[WormRecord]} An array of WormRecords that fits the given query
   */
  RecordBaseClass.queryAll = function(sql, params, cb) {
    doQuery(arguments, function(rows, cb) {
      var results = [];
      for (var i=0,l=rows.length; i<l; ++i) {
        results.push(new RecordBaseClass(rows[i]));
      }
      cb(null, results);
    });
  }

  if (data.classMethods) {
    for(var method in data.classMethods) {
      RecordBaseClass[method] = data.classMethods[method];
    }
  }
  
  // some static properties:
  RecordBaseClass.__defineGetter__('tableName', function() { return tableName; });

  return RecordBaseClass;
};

module.exports = WormRecordFactory;
