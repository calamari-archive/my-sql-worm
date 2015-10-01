var WormRecord  = require(__dirname + '/worm_record'),
    Parallel    = require(__dirname + '/../deps/parallel');

var WormRecordFactory = function(recordName, data, mySqlWorm) {
  data            = data || {};
  this._mySqlWorm = mySqlWorm;
  var tableName   = recordName + 's',
      idField     = recordName.substr(0,1).toLowerCase() + recordName.substr(1) + 'Id',
      QUERY_FIND  = "SELECT * FROM " + tableName,
      QUERY_WHERE = " WHERE " + idField + "=?",
      QUERY_LIMIT = " LIMIT ",
      QUERY_REMOVE_ONE = 'DELETE FROM `' + tableName + '` WHERE ' + idField + '=?',
      QUERY_REMOVE_ALL = 'DELETE FROM `' + tableName + '`';

  // process the data
  var RecordBaseClass = function(obj, loaded) {
    var record = new WormRecord(tableName, mySqlWorm, idField);

    if (data.structure) {
      var vnr = 1, version;
      while(version = data.structure['version' + vnr]) {
        version.apply(record);
        ++vnr;
      }
    };
    record.initialize(obj, loaded);

    if (data.instanceMethods) {
      for (var method in data.instanceMethods) {
        record[method] = data.instanceMethods[method];
      }
    }

    if (data.getter) {
      for (var name in data.getter) {
        record.__defineGetter__(name, data.getter[name]);
      }
    }

    if (data.setter) {
      for (var name in data.setter) {
        record.__defineSetter__(name, data.setter[name]);
      }
    }

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
        cb(null, new RecordBaseClass(rows[0], true));
      } else {
        cb(null, null);
      }
    });
  };

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
        results.push(new RecordBaseClass(rows[i], true));
      }
      cb(null, results);
    });
  };

  /**
   * Loads all records of that type as HAsh with id=key and record=value
   * @param {Function} cb Callback where we load our ressources
   * @returns {Object[WormRecord]} An array of WormRecords that fits the given query
   */
  RecordBaseClass.queryAllAsHash = function(sql, params, cb) {
    if (typeof cb === 'undefined') {
      cb = params;
      params = [];
    }
    RecordBaseClass.queryAll(sql, params, function(err, records) {
      if (err) { cb(err); } else {
        var result = {};
        records.forEach(function(r) {
          result[r.id] = r;
        });
        cb(null, result);
      }
    });
  };

  /**
   * Loads the record with given id
   * @param {Number} id ID of record we want to load
   * @param {Function} cb Callback where we load our ressources
   * @returns {Array[WormRecord]} An array of WormRecords that fits the given query
   */
  RecordBaseClass.find = function(id, cb) {
    doQuery([QUERY_FIND + QUERY_WHERE + QUERY_LIMIT + "1", [id], cb], function(rows, cb) {
      if (rows.length) {
        cb(null, new RecordBaseClass(rows[0], true));
      } else {
        cb(null, null);
      }
    });
  };

  /**
   * Loads all records of that type
   * @param {Function} cb Callback where we load our ressources
   * @returns {Array[WormRecord]} An array of WormRecords that fits the given query
   */
  RecordBaseClass.findAll = function(cb) {
    doQuery([QUERY_FIND, [], cb], function(rows, cb) {
      var results = [];
      for (var i=0,l=rows.length; i<l; ++i) {
        results.push(new RecordBaseClass(rows[i], true));
      }
      cb(null, results);
    });
  };

  /**
   * Loads all records of that type as HAsh with id=key and record=value
   * @param {Function} cb Callback where we load our ressources
   * @returns {Object[WormRecord]} An array of WormRecords that fits the given query
   */
  RecordBaseClass.findAllAsHash = function(cb) {
    RecordBaseClass.findAll(function(err, records) {
      if (err) { cb(err); } else {
        var result = {};
        records.forEach(function(r) {
          result[r.id] = r;
        });
        cb(null, result);
      }
    });
  };

  /**
   * Removes one or all Items from database
   * @param {Number} [id] ID of item to remove (if ommitted all items will be deleted)
   * @param {Function} cb callback to call after removing has finished
   */
  RecordBaseClass.remove = function(id, cb) {
    if (typeof cb === 'undefined') {
      cb = id;
      mySqlWorm.query(QUERY_REMOVE_ALL, function(err, rows) {
        cb(err, err ? 0 : rows.affectedRows);
      });
    } else {
      mySqlWorm.query(QUERY_REMOVE_ONE, [ id ], function(err, rows) {
        cb(err, err ? 0 : rows.affectedRows);
      });
    }
  };

  /**
   * Saves one or all Items to database
   * @param {WormRecord|Array[WormRecord]} [records] One or more records
   * @param {Function} cb callback to call after saving has finished
   */
  RecordBaseClass.save = function(records, cb) {
    if (!Array.isArray(records)) { records = [ records ]; }
    cb = cb || function() {};
    var num = records.length,
        errors = [],
        result = [];
    
    records.forEach(function(record) {
      record.save(function(err, r) {
        if (err) {
          err.item = record;
          errors.push(err);
        } else {
          result.push(record);
        }

        if (!--num) {
          cb(errors.length ? errors : null, result);
        }
      });
    });
  };

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
