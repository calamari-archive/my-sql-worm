
var errors      = require(__dirname + '/worm_errors');

var WormRecord = function(tableName, mySqlWorm, idFieldName) {
  var _isNew           = true
  ,   _isDeleted       = false
  ,   _dirtyAttributes = []
  ,   _data            = {}
  ,   _definition      = {}
  ,   _id              = null

  ,   QUERY_SAVE       = 'INSERT INTO `' + tableName + '` ({columns}) VALUES ({values});'
  ,   QUERY_UPDATE     = 'UPDATE `' + tableName + '` SET {values} WHERE ' + idFieldName + '={id};'
  ,   QUERY_REMOVE     = 'DELETE FROM `' + tableName + '` WHERE ' + idFieldName + '=?'
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
    if (!_definition[key]) {
      throw new errors.AttributeNotDefinedError('Key ' + key + ' is not defined on Record ' + tableName);
    }
    return _data[key];
  };

  var propertyGetter = function(colName) {
    var value = this.getAttribute(colName);
    // use defined getter
    if (colName !== idFieldName && _definition[colName].getter) {
      value = _definition[colName].getter(value);
    }
    return value;
  };

  var propertySetter = function(colName, value) {
    // use defined setter
    if (colName !== idFieldName && !_definition[colName]) {
      throw new errors.MissingDefinitionError('Writing field ' + colName + ' was not successful. Field is not defined in table ' + tableName);
    }
    if (colName !== idFieldName && _definition[colName].setter) {
      value = _definition[colName].setter(value);
    }
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
    // if type is an object, it must be our DATETIME
    if (def.type.constructor === Object) {
      _definition[colName] = {};
      for (var i in def.type) {
        _definition[colName][i] = def.type[i];
      }
      for (var i in def) {
        if (i !== 'type') {
          _definition[colName][i] = def[i];
        }
      }
    } else {
      _definition[colName] = def;
    }
    if (def.setter && def.setter.constructor !== Function) {
      throw new errors.WrongDefinitionError('Definition of ' + colName + ' contains invalid setter.');
    }
    if (def.getter && def.getter.constructor !== Function) {
      throw new errors.WrongDefinitionError('Definition of ' + colName + ' contains invalid getter.');
    }

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
  this.initialize = function(data, isLoaded) {
    if (isLoaded) {
      for(var colName in data) {
       this.setAttribute(colName, _definition[colName] && _definition[colName].onSave ? _definition[colName].onLoad(data[colName]) : data[colName]);
       //this.setAttribute(colName, data[colName]);
      }
      _isNew = false;
      _dirtyAttributes = [];
      _id = data[idFieldName];
    } else {
      for(var colName in data) {
        propertySetter.call(this, colName, data[colName]);
      }
    }
  };

  /**
   * Saves the data of this record to db.
   * Saves only the data, we specified in the structure
   * @params {Function} [cb] Callback to call, when finished
   */
  this.save = function(cb) {
    cb = cb || function() {};

    var self   = this,
        cols   = [],
        qmarks = [],
        params = [],
        query,
        value,
        validationErrors = [];

    // to some validation
    Object.keys(_definition).forEach(function(field) {
      if (_definition[field].validate) {
        var validator = _definition[field].validate,
            isFunc = validator.constructor === Function;
        value = self.getAttribute(field);
        if ((value && !(isFunc ? validator(value) : validator.test(value)))
         || (_definition[field].notEmpty && !value)) {
          validationErrors.push(field);
        }
      }
    });
    if (validationErrors.length) {
      var error = new errors.ValidationError('Some fields did not validate');
      error.data = validationErrors;
      cb(error, self);
      return;
    }

    if (_id) {
      // we save only updated values on update
      for(var i=_dirtyAttributes.length; i--;) {
        var field = _dirtyAttributes[i],
            value = this.getAttribute(field);

        cols.push(_dirtyAttributes[i] + '=?');
        params.push(_definition[field].onSave ? _definition[field].onSave(value) : value);
      }
      query = QUERY_UPDATE
        .replace('{values}', cols.join(','))
        .replace('{id}', _id);
    } else {
      // we save all values on insert
      Object.keys(_definition).forEach(function(field) {
        var value = self.getAttribute(field);

        qmarks.push('?');
        cols.push('`' + field + '`');
        params.push(_definition[field].onSave ? _definition[field].onSave(value) : value || '');
      });

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

  /**
   * Removes this item from db
   */
  this.remove = function(cb) {
    var self = this;
    mySqlWorm.query(QUERY_REMOVE, [_id], function(err, result) {
      if (!err) {
        _id = null;
        _isDeleted = true;
      }
      cb(err, self);
    });
  };

  this.__defineGetter__('isNew', function() { return _isNew; });
  this.__defineGetter__('dirtyAttributes', function() { return _dirtyAttributes; });
  this.__defineGetter__('isDirty', function() { return !!_dirtyAttributes.length; });
  this.__defineGetter__('id', function() { return _id; });
  this.__defineGetter__('isDeleted', function() { return _isDeleted; });

  this.__defineGetter__('data', function() { return _data; });
};



module.exports = WormRecord;
