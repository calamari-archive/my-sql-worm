
var testCase     = require('nodeunit').testCase
,  	TEST_DB_DATA = {
      user:     'root',
      password: '',
      database: 'mysqlworm_test',
      host:     '127.0.0.1',
      port:     3306
    }
,	  MySqlClient  = require('../deps/mysql').Client
,	  client

,   MySqlWorm    = require('../index')
,   errors       = require('../lib/worm_errors')
;


module.exports = testCase({
  setUp: function(done) {
    client = new MySqlClient(TEST_DB_DATA);
    client.connect(function(err) {
      if (err) console.log(err);
      done();
    });
  },
  tearDown: function(done) {
    client.end(function(err) {
      if (err) console.log(err);
      done();
    });
  },
  'test creation of mysqlworm object': function(test) {
    var worm;

    test.throws(function() {
      new MySqlWorm();
    }, errors.MissingArgumentsError, 'should throw');
    test.throws(function() {
      new MySqlWorm({});
    }, errors.MissingArgumentsError, 'should throw');
    test.doesNotThrow(function() {
      worm = new MySqlWorm({
        connection: TEST_DB_DATA
      });
    }, errors.WrongArgumentsError, 'should throw');

    test.ok(!worm.isConnected, 'should only open a connection when first query goes out');
    worm.connect(function(err) {
      test.ok(!err, 'should not throw an error, if it does, check the mysql credentials');
      test.ok(worm.isConnected, 'should now have an open connection');

      worm.disconnect(function(err) {
        test.ok(!worm.isConnected, 'should have no open connection after disconnecting');
        test.done();
      });
    });
  }
});
