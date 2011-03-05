
var WormRecord = function(data) {
  _isNew = true;
  _dirtyAttributes = [];
  
  this.__defineGetter__('isNew', function() { return _isNew; });
  this.__defineGetter__('dirtyAttributes', function() { return _dirtyAttributes; });
};



module.exports = WormRecord;
