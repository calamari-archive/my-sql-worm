
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
,   worm

,   MySqlWorm    = require('../index')
,   WormRecord   = require('../lib/worm_record')
,   errors       = require('../lib/worm_errors')

,   SQL_TABLE_TASKS  = 'CREATE TABLE `Tasks` ('
                     + '`taskId` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,'
                     + '`title` VARCHAR(255) NOT NULL,'
                     + '`title` TEXT NOT NULL'
                     + ');'
;


module.exports = testCase({
  setUp: function(done) {
    client = new MySqlClient(TEST_DB_DATA);
    client.connect(function(err) {
      if (err) console.log(err);
      worm = new MySqlWorm({
        connection: TEST_DB_DATA
      });
      done();
    });
  },
  tearDown: function(done) {
    client.end(function(err) {
      if (err) console.log(err);
      worm.disconnect(function(err) {
        if (err) console.log(err);
        done();
      });
    });
  },

  'test adding of columns to the definition of WormRecords': function(test) {
test.done(); return;
    client.query(SQL_TABLE_TASKS, function(err) {
      if (err) console.log(err);
      var Task  = worm.define('Task', {
            definitions: {
              version1: function() {
                this.addColumn('title', worm.STRING);
                this.addColumn('Description', { type: worm.TEXT, default: 'nothin\'' });
              }
            }
          })
      ,   task1 = new Task();

      test.equal(task1.isNew, true, 'A new created record should be marked as new');
      test.equal(task1.dirtyAttributes.length, 0, 'We should not have touched any attributes');
      test.done();
    });
  }

});
