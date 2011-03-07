
var errors      = require(__dirname + '/worm_errors');

var WormRecord = function(tableName, mySqlWorm, idFieldName) {
  var _isNew           = true
  ,   _dirtyAttributes = []
  ,   _data            = {}
  ,   _definition      = {}
  ,   _id              = null

  ,   QUERY_SAVE       = 'INSERT INTO `' + tableName + '` ({columns}) VALUES ({values});'
  ,   QUERY_UPDATE     = 'UPDATE `' + tableName + '` SET {values} WHERE ' + idFieldName + '={id};'
  ;

  /**
   * Writes the attribute without considering defined setter methods
   * @param {String} key Which attribute to set
   * @param {Mixed} value The value to set for this attribute
   * @private
   */
  this.setAttribute = function(key, value) {
    _data[key] = value;
    if (_dirtyAttributes.indexOf(key) === -1) {
      _dirtyAttributes.push(key);
    }
  };

  /**
   * Reads the plain attributes, without defined getter methods
   * @param {String} key Which attribute to get
   * @private
   */
  this.getAttribute = function(key) {
    return _data[key];
  };

  var propertyGetter = function(colName) {
      return this.getAttribute(colName);
  };

  var propertySetter = function(colName, value) {
      this.setAttribute(colName, value);
  };

  /**
   * Adds a new column defintion
   */
  this.addColumn = function(colName, def) {
    if (!def) throw new errors.MissingDefinitionError('No Definition defined for key ' + colName);
    if (def.constructor !== Object) {
      def = { type: def };
    }
    _definition[colName] = def;

    // preset default value
    if (typeof def !== 'undefined' && def.default !== null) {
      _data[colName] = def.default;
    }

    // define getter and setter methods
    this.__defineGetter__(colName, function() {
      return propertyGetter.call(this, colName);
    });
    this.__defineSetter__(colName, function(value) {
      propertySetter.call(this, colName, value);
    });
  };
  
  /**
   * This gets called from WormRecordFactory and contains all
   * properties, that are given within the constructionof WormRecord
   * @private
   */
  this.initialize = function(data) {
    for(var colName in data) {
      propertySetter.call(this, colName, data[colName]);
    }
    wasLoaded(data);
  };

  /**
   * Call this, if the data provided is already in db (e.g. we loaded it just now)
   * this should only be used in WormRecordFactory class
   */
  function wasLoaded(data) {
    if (data && data[idFieldName]) {
      _isNew = false;
      _dirtyAttributes = [];
      _id = data[idFieldName];
    }
  };
  
  /**
   * Saves the data of this record to db.
   * Saves only the data, we specified in the structure
   * @params {Function} [cb] Callback to call, when finished
   */
  this.save = function(cb) {
    cb = cb || function() {};
    // TODO: validation stuff here
    
    var self   = this,
        cols   = [],
        qmarks = [],
        params = [],
        query;

    if (_id) {
      for(var i=_dirtyAttributes.length; i--;) {
        cols.push(_dirtyAttributes[i] + '=?');
        params.push(this.getAttribute(_dirtyAttributes[i]));
      }
      query = QUERY_UPDATE
        .replace('{values}', cols.join(','))
        .replace('{id}', _id);
    } else {
      for(var i=_dirtyAttributes.length; i--;) {
        qmarks.push('?');
        cols.push(_dirtyAttributes[i]);
        params.push(this.getAttribute(_dirtyAttributes[i]));
      }
      query = QUERY_SAVE
        .replace('{columns}', cols.join(','))
        .replace('{values}', qmarks.join(','));
    }

    mySqlWorm.query(query, params, function(err, result) {
        if (!err) {
          if (!_id) {
            _data[idFieldName] = _id = result.insertId;
          }
          _isNew = false;
          _dirtyAttributes = [];
        }
        cb(err, self);
      }
    );
  };

  this.__defineGetter__('isNew', function() { return _isNew; });
  this.__defineGetter__('dirtyAttributes', function() { return _dirtyAttributes; });
  this.__defineGetter__('isDirty', function() { return !!_dirtyAttributes.length; });
  this.__defineGetter__('id', function() { return _id; });

  this.__defineGetter__('data', function() { return _data; });
};



module.exports = WormRecord;
