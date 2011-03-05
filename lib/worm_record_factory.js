var WormRecord  = require(__dirname + '/worm_record');

var WormRecordFactory = function(data, mySqlWorm) {
  this._mySqlWorm = mySqlWorm;

  // process the data
  return WormRecord;
};

module.exports = WormRecordFactory;
