
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

,   SQL_TABLE_PROJECTS  = 'CREATE TABLE `Projects` ('
                        + '`projectId` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,'
                        + '`title` VARCHAR( 255 ) NOT NULL'
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

      worm.define('Foo', {});
      worm.define('Project', {
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

  'test basic instantiation': function(test) {
    var Foo  = worm.getModel('Foo')
    ,   foo1 = new Foo();
    
    test.equal(foo1.isNew, true, 'A new created record should be marked as new');
    test.equal(foo1.dirtyAttributes.length, 0, 'We should not have touched any attributes');
    test.done();
  },

  'test basic inserting': function(test) {
  test.done(); return;
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);
      
      var Project = worm.getModel('Project');
      
      test.done();
    });
  }
});
