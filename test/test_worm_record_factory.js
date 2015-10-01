
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

,   SQL_TABLE_TASKS  = 'CREATE TABLE IF NOT EXISTS `Tasks` ('
                     + '`taskId` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,'
                     + '`title` VARCHAR(255) NOT NULL,'
                     + '`description` TEXT NOT NULL,'
                     + '`someNumber` INT NOT NULL'
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
      client.query(SQL_TABLE_TASKS, function(err) {
        if (err) console.log(err);
        done();
      });
    });
  },
  tearDown: function(done) {
    client.query('DROP TABLE IF EXISTS `Tasks`', function() {
      client.end(function(err) {
        if (err) console.log(err);
        worm.disconnect(function(err) {
          if (err) console.log(err);
          done();
        });
      });
    });
  },

  'test adding of columns to the definition of WormRecords': function(test) {
    
      var Task  = worm.define('Task', {
            structure: {
              version1: function() {
                this.addColumn('title', MySqlWorm.STRING);
                this.addColumn('description', { type: MySqlWorm.TEXT, default: 'nothin\'' });
              },
              version2: function() {
                this.addColumn('someNumber', { type: MySqlWorm.INT });
              }
            }
          })
      ,   task1 = new Task();

      test.equal(task1.isNew, true, 'A new created record should be marked as new');
      test.equal(task1.dirtyAttributes.length, 0, 'We should not have touched any attributes');
      test.throws(function() {
        task1.getAttribute('x');
      }, errors.AttributeNotDefinedError, 'Not defined columns should not be defined within the record object');
      test.doesNotThrow(function() {
        task1.getAttribute('title');
        task1.getAttribute('someNumber');
      }, Error, 'Defined columns should not raise any errors although they have no values');

      task1.title = 'Going to hell';
      task1.someNumber = 666;
      task1.why = 'Why not?'; // this shouldn't be saved

      task1.save(function(err, t1) {
        test.equal(err, null);
        
        client.query('SELECT * FROM Tasks', function(err, rows) {
          test.equal(rows.length, 1, 'should be one row in the db');
          test.equal(rows[0].title, 'Going to hell', 'title should be the one we set');
          test.equal(rows[0].someNumber, 666, 'someNumber should be the one we set');
          test.equal(rows[0].why, null, 'The why wasn\'t defined, so it should not be stored');
          test.done();
        });
      });
  }

});
