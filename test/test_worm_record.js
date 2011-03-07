
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

,   SQL_TABLE_PROJECTS  = 'CREATE TABLE IF NOT EXISTS `Projects` ('
                        + '`projectId` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,'
                        + '`title` VARCHAR( 255 ) NOT NULL,'
                        + '`description` TEXT NOT NULL'
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

      // define some tables for testing
      worm.define('Foo', {});
      worm.define('Project', {
        structure: {
          version1: function() {
            this.addColumn('title', MySqlWorm.STRING);
            this.addColumn('description', { type: MySqlWorm.TEXT, default: 'Nothin\'' });
          }
        }
      });

      done();
    });
  },
  tearDown: function(done) {
    client.query('DROP TABLE IF EXISTS `Projects`', function() {
      client.end(function(err) {
        if (err) console.log(err);
        worm.disconnect(function(err) {
          if (err) console.log(err);
          done();
        });
      });
    });
  },

  'test basic instantiation and attributes': function(test) {
    var Foo  = worm.getModel('Foo')
    ,   foo1 = new Foo();
    
    test.equal(foo1.isNew, true, 'A new created record should be marked as new');
    test.equal(foo1.dirtyAttributes.length, 0, 'We should not have touched any attributes');
    test.ok(!foo1.isDirty, 'We should not have touched any attributes');
    test.done();
  },

  'test basic inserting': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'Burlesque' });
      
      test.equal(p1.isNew, true, 'should be marked as newly created');
      test.equal(p1.dirtyAttributes.length, 1, 'There should be one attribute that we set');
      test.equal(p1.dirtyAttributes[0], 'title', 'We should have added a title');
      test.ok(p1.isDirty, 'We should have touched at least one attribute');
      
      test.equal(p1.title, 'Burlesque', 'Title should have been set correctly');
      test.equal(p1.description, 'Nothin\'', 'Description should get default value');
      
      p1.description = 'Something';
      test.equal(p1.description, 'Something', 'Description should no be something');
      test.equal(p1.dirtyAttributes.length, 2, 'There should be two attribute that we set');
      test.ok(p1.dirtyAttributes.indexOf('title') > -1, 'We should have added a title');
      test.ok(p1.dirtyAttributes.indexOf('description') > -1, 'We should have added a description');

      p1.title = 'Dancing';
      test.equal(p1.dirtyAttributes.length, 2, 'There should still be two attribute that we set, because we already set title');
      test.equal(p1.title, 'Dancing', 'Title should have changed');
      p1.save(function() {
        test.ok(!p1.isNew, 'Now it is saved, and should therefore not be new');
        test.ok(!p1.isDirty, 'Its saved and should not be dirty anymore');
        test.equal(p1.dirtyAttributes.length, 0, 'There should be no attributes left, that are changed from the db persisted copy');

        // check in db, if the right values were saved
        client.query('SELECT * FROM Projects', function(err, rows) {
          test.equal(rows.length, 1, 'should be one row in the db');
          test.equal(rows[0].title, 'Dancing', 'title should be the one we set');
          test.equal(rows[0].description, 'Something', 'description should be the one we set');
          test.done();
        });
      });
      
    });
  },

  'test basic querying': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'Burlesque' })
      ,   p2      = new Project({ title: 'Scooby', description: 'Doo' });

      p1.save(function(err) {
        test.equal(err, null);
        p2.save(function(err) {
          test.equal(err, null);

          test.equal(p1.id, 1, 'p1 should have 1 as id');
          test.equal(p2.id, 2, 'p2 should have 2 as id');

          // now the test can start...
          Project.queryOne("SELECT * FROM Projects WHERE projectId=1", function(err, p1db) {
            test.equal(err, null);
            test.equal(p1db.constructor, WormRecord, 'result should be a WormRecord');
            test.ok(!p1db.isNew, 'should not be new');
            test.ok(!p1db.isDirty, 'should not be dirty');
            test.equal(p1db.title, 'Burlesque', 'Should be our first saved Project');
          });

          // now loading an entry that isn't there
          Project.queryOne("SELECT * FROM Projects WHERE projectId=3", function(err, nothing) {
            test.equal(err, null);
            test.equal(nothing, null, 'Nothing should have been loaded');
          });

          // loading with secured params
          Project.queryOne("SELECT * FROM Projects WHERE title=?", ['Scooby'], function(err, p2db) {
            test.equal(err, null);
            test.equal(p2db.constructor, WormRecord, 'result should be a WormRecord');
            test.ok(!p2db.isNew, 'should not be new');
            test.ok(!p2db.isDirty, 'should not be dirty');
            test.equal(p2db.title, 'Scooby', 'Should be our first saved Project');
            test.equal(p2db.description, 'Doo', 'Should have loaded all entries');
          });

          // now we try loading a subset
          // ATTENTION: This is not recommend, and if you do, ONLY WITH id column!!!
          Project.queryOne("SELECT projectId,description FROM Projects WHERE title='Scooby'", function(err, p2db2) {
            test.equal(err, null);

            test.equal(p2db2.constructor, WormRecord, 'result should be a WormRecord');
            test.ok(!p2db2.isNew, 'should not be new');
            test.ok(!p2db2.isDirty, 'should not be dirty');
            test.equal(p2db2.title, null, 'Should not have loaded the title');
            test.equal(p2db2.description, 'Doo', 'Should have loaded all the description');
            p2db2.description = 'diving';
            test.equal(p2db2.description, 'diving');
            test.ok(p2db2.isDirty, 'should be dirty after changing description');
            test.ok(p2db2.dirtyAttributes.indexOf('description') > -1, 'We should have changed the description');
            p2db2.save(function(err) {
              test.equal(err, null);

              test.ok(!p2db2.isNew, 'should not be new');
              test.ok(!p2db2.isDirty, 'should not be dirty anymore');
              Project.queryOne("SELECT * FROM Projects WHERE title='Scooby'", function(err, p2db3) {
                test.equal(err, null);

                test.equal(p2db3.constructor, WormRecord, 'result should be a WormRecord');
                test.ok(!p2db3.isNew, 'should not be new');
                test.ok(!p2db3.isDirty, 'should not be dirty');
                test.equal(p2db3.title, 'Scooby', 'Should not have touched the title on save');
                test.equal(p2db3.description, 'diving', 'Should have saved our new description');


                // check in db still has only 2 items
                client.query('SELECT * FROM Projects', function(err, rows) {
                  test.equal(rows.length, 2, 'We should not have created a new itme');
                  test.done();
                });
              });
            });
          });

        });
      });
    });
  },

  'test getting data out of the record': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'Scooby', description: 'Doo' })
      ,   p2      = new Project({ title: 'Oho' });

      test.equal(p1.data.title, 'Scooby');
      test.equal(p1.data.description, 'Doo');
      test.equal(p1.data.projectId, null);

      test.equal(p2.data.description, 'Nothin\'', 'The default value should be returned');
      test.equal(p2.data.projectId, null);

      p1.save(function(err) {
        test.equal(err, null);

        test.equal(p1.data.title, 'Scooby');
        test.equal(p1.data.projectId, 1);
        test.equal(p1.data.projectId, p1.id);

        // TODO: add some more tests with getter and setter
        test.done();
      });
    });
  },

  'test result of save': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);
      var Project = worm.getModel('Project');

      (new Project({ title: 'Singing', description: 'Singer' })).save(function(err, p1) {
        test.equal(err, null);
        test.equal(p1.constructor, WormRecord, 'result should be a WormRecord');

        test.equal(p1.data.title, 'Singing');
        test.equal(p1.data.projectId, 1);
        test.equal(p1.id, 1);
        test.equal(p1.data.description, 'Singer');

        // TODO: add error checks for validation
        test.done();
      });
    });
  }
});
