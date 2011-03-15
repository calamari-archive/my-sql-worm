
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
,   WormHelpers  = require('../lib/worm_helpers')
,   errors       = require('../lib/worm_errors')

,   Parallel     = require('../deps/parallel')

,   SQL_TABLE_PROJECTS  = 'CREATE TABLE IF NOT EXISTS `Projects` ('
                        + '`projectId` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,'
                        + '`title` VARCHAR( 255 ) NOT NULL,'
                        + '`description` TEXT NOT NULL'
                        + ');'
,   SQL_TABLE_A_METHOD  = 'CREATE TABLE IF NOT EXISTS `AMethods` ('
                        + '`aMethodsId` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,'
                        + '`hello` VARCHAR( 255 ) NOT NULL,'
                        + '`withNumber` VARCHAR( 255 ) NOT NULL,'
                        + '`all` VARCHAR( 255 ) NOT NULL'
                        + ');'
,   SQL_TABLE_TIMETEST  = 'CREATE TABLE IF NOT EXISTS `Timetests` ('
                        + '`timetestId` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,'
                        + '`title` VARCHAR( 255 ) NOT NULL,'
                        + '`time` DATETIME NOT NULL'
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
        },
        classMethods: {
          loadIt: function(cb) {
            this.queryOne("SELECT * FROM " + this.tableName + " WHERE description=?", [ 'Hello' ], cb);
          }
        }
      });

      done();
    });
  },
  tearDown: function(done) {
    client.query('DROP TABLE IF EXISTS `Projects`', function() {
      client.query('DROP TABLE IF EXISTS `AMethods`', function() {
        client.query('DROP TABLE IF EXISTS `Timetests`', function() {
          client.end(function(err) {
            if (err) console.log(err);
            worm.disconnect(function(err) {
              if (err) console.log(err);
              done();
            });
          });
        });
      });
    });
  },

  'test basic instantiation and attributes': function(test) {
    test.expect(2);
    var Foo  = worm.getModel('Foo');
    try {
      var foo1 = new Foo({ dontExist: true });
    } catch(error) {
      test.equal(error.name, 'MissingDefinitionError', 'Should throw an MissingDefinitionError');
      test.ok(/dontExist/.test(error.message), 'Error should contain name of wrong field we entered.');
    }

    test.done();
  },

  'test basic instantiation throws speaking errors if set with something unexpected': function(test) {
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
                  test.equal(rows.length, 2, 'We should not have created a new item');
                  test.done();
                });
              });
            });
          });
        });
      });

    });
  },

  'test getter and setter': function(test) {
    var Model = worm.define('Model', {
      structure: {
        version1: function() {
          this.addColumn('email', { type: MySqlWorm.STRING, getter: function(v) {
            return v.toLowerCase();
          } });
          this.addColumn('password', { type: MySqlWorm.STRING, setter: function(v) {
            return 'somesalt' + v;
          } });
          this.addColumn('foo', {
            type: MySqlWorm.INT,
            getter: function(v) {
              return v+v;
            },
            setter: function(v) {
              return v - 1;
            }
          });
        }
      }
    });

    // Test setting them within record construction
    var m1 = new Model({
      password: 'qwertz',
      foo: 3
    });
    test.equal(m1.getAttribute('password'), 'somesaltqwertz', 'The setter should be called before it is saved into internal storage');
    test.equal(m1.password, 'somesaltqwertz', 'No getter should get the value that is stored');

    test.equal(m1.getAttribute('foo'), 2, 'The setter should have substracted 1');
    test.equal(m1.foo, 4, 'The getter should add the same to the stored valued');
    
    m1.email = 'Joe@Doe.com';
    test.equal(m1.getAttribute('email'), 'Joe@Doe.com', 'No setter so nothing has changed');
    test.equal(m1.email, 'joe@doe.com', 'The getter should have lower cased the value');

    m1.foo = 11;
    test.equal(m1.getAttribute('foo'), 10, 'The setter should have substracted 1');
    test.equal(m1.foo, 20, 'The getter should add the same to the stored valued');

    var Model2 = worm.define('Model2', {
      structure: {
        version1: function() {
          this.addColumn('a', { type: MySqlWorm.INT, getter: 5 });
        }
      }
    });
    test.throws(function() {
      // TODO: This error should be thrown on definition time, not on instantiation time
      var m2 = new Model2();
    }, errors.WrongDefinitionError, 'none function setter should throw');
    var Model3 = worm.define('Model2', {
      structure: {
        version1: function() {
          this.addColumn('a', { type: MySqlWorm.INT, setter: 5 });
        }
      }
    });
    test.throws(function() {
      var m3 = new Model3();
    }, errors.WrongDefinitionError, 'none function getter should throw');

    test.done();
  },

  'test getters and setters on object': function(test) {
     var User = worm.define('User', {
      structure: {
        version1: function() {
          this.addColumn('firstname', MySqlWorm.STRING);
          this.addColumn('lastname', MySqlWorm.STRING);
        }
      },
      getter: {
        fullname: function() {
          return ((this.firstname || '') + ' ' + (this.lastname || '')).trim();
        }
      },
      setter: {
        fullname: function(name) {
          var namesplit = name.split(' ');
          this.firstname = namesplit[0];
          this.lastname = namesplit[1];
        }
      }
    });

    var u1 = new User({
      firstname: 'Buddy',
      lastname:  'Hollywood'
    });
    test.equal(u1.fullname, 'Buddy Hollywood');
    u1.lastname = 'Holly';
    test.equal(u1.fullname, 'Buddy Holly');
    var u2 = new User();
    test.equal(u2.fullname, '');
    u2.fullname = 'Michael Jackson';
    test.equal(u2.firstname, 'Michael', 'fullname should store in first and lastname');
    test.equal(u2.lastname, 'Jackson', 'fullname should store in first and lastname');
    test.done();
  },

  'test querying for items at once': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'Dancing' })
      ,   p2      = new Project({ title: 'Speaking', description: 'Hey you!' })
      ,   p3      = new Project({ title: 'Watching Movies', description: 'The Dark Knight' });

      p1.save(function(err) {
        test.equal(err, null);
        p2.save(function(err) {
          test.equal(err, null);
          p3.save(function(err) {
            test.equal(err, null);
            
            Project.queryAll("SELECT * FROM Projects WHERE projectId>1 ORDER BY projectId ASC", function(err, projects) {
              test.equal(err, null);
              
              test.equal(projects.length, 2, 'Should have got two projects');
              test.equal(projects[0].constructor, WormRecord, 'Should have got objects of type WormRecords');
              test.equal(projects[1].constructor, WormRecord, 'Should have got objects of type WormRecords');
              test.equal(projects[0].title, 'Speaking', 'Should be the second saved project');
              test.equal(projects[1].title, 'Watching Movies', 'Should be the third saved project');
              
              test.done();
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
  },

  'test static methods': function(test) {
    test.expect(5);
    var TestModel = worm.define('TestModel', {
      structure: {
        version1: function() {
          this.addColumn('title', MySqlWorm.STRING);
          this.addColumn('count', { type: MySqlWorm.INT, default: 0 });
        }
      },
      classMethods: {
        testMe: function(foo) {
          test.equal(foo, 42, 'this should be called with my argument');
        },
        createObject: function(title) {
          return new this({ title: title, count: title.length });
        },
        loadObjectFromDb: function(title) {
          return new this({ title: title, count: title.length });
        }
      }
    });

    TestModel.testMe(42);

    var obj = TestModel.createObject('foobar');
    test.equal(obj.constructor, WormRecord, 'Should have create a instance of WormRecord');
    test.equal(obj.title, 'foobar', 'Should have create a record with title foobar');
    test.equal(obj.count, 6, 'Should have create a record with count of 6');
    test.ok(obj.isNew, 'Should have create a record that is marked as new');

    test.done();
  },

  'test static method that loads record from db': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);
      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'English', description: 'Hello' })
      ,   p2      = new Project({ title: 'German', description: 'Hallo' });

      p1.save(function(err) {
        test.equal(err, null);
        p2.save(function(err) {
          test.equal(err, null);

          Project.loadIt(function(err, myProject) {
            test.equal(myProject.constructor, WormRecord, 'Should have create a instance of WormRecord');
            test.equal(myProject.title, 'English', 'Should have create a record with title English');
            test.equal(myProject.description, 'Hello', 'Should have create a record with description Hello');
            test.ok(!myProject.isNew, 'Should have loaded a record from db');
            test.equal(myProject.id, 1, 'Should be the first project we created');

            test.done();
          });
        });
      });
    });
  },

  'test static method that loads record from db': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);
      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'English', description: 'Hello' })
      ,   p2      = new Project({ title: 'German', description: 'Hallo' });

      Project.loadMore = function(cb) {
        this.queryAll("SELECT * FROM " + this.tableName + " WHERE title=?", [ 'German' ], cb);
      }

      p1.save(function(err) {
        test.equal(err, null);
        p2.save(function(err) {
          test.equal(err, null);

          Project.loadMore(function(err, projects) {
            test.equal(projects.length, 1, 'should got one record in an array');
            test.equal(projects[0].constructor, WormRecord, 'Should have create a instance of WormRecord');
            test.equal(projects[0].title, 'German', 'Should have create a record with title German');
            test.equal(projects[0].description, 'Hallo', 'Should have create a record with description Hallo');
            test.ok(!projects[0].isNew, 'Should have loaded a record from db');
            test.equal(projects[0].id, 2, 'Should be the first project we created');

            test.done();
          });
        });
      });
    });
  },

  'test Record.find': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);
      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'My-sql-worm', description: 'A MySQL ORM' })
      ,   p2      = new Project({ title: 'node-parallel', description: 'Flow manager' })
      ,   p3      = new Project({ title: 'jaz-toolkit', description: 'Useful functions' });


      p1.save(function(err) {
        test.equal(err, null);
        p2.save(function(err) {
          test.equal(err, null);
          p3.save(function(err) {
            test.equal(err, null);

            Project.find(3, function(err, p4) {
              test.equal(err, null);
              test.equal(p4.id, 3, 'should have loaded project with id 3');
              test.equal(p4.title, 'jaz-toolkit', 'should have loaded project jaz-toolkit');

              Project.find(2, function(err, p5) {
                test.equal(err, null);
                test.equal(p5.id, 2, 'should have loaded project with id 2');
                test.equal(p5.title, 'node-parallel', 'should have loaded project jaz-toolkit');

                Project.find(4, function(err, p6) {
                  test.equal(err, null);
                  test.equal(p6, null, 'this project should not exist');

                  test.done();
                });
              });
            });

          });
        });
      });
    });
  },

  'test Record.findAll': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);
      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'My-sql-worm', description: 'A MySQL ORM' })
      ,   p2      = new Project({ title: 'node-parallel', description: 'Flow manager' })
      ,   p3      = new Project({ title: 'jaz-toolkit', description: 'Useful functions' });


      p1.save(function(err) {
        test.equal(err, null);
        p2.save(function(err) {
          test.equal(err, null);
          p3.save(function(err) {
            test.equal(err, null);

            Project.findAll(function(err, records) {
              test.equal(err, null);
              test.equal(records.length, 3, 'should have loaded all previously saved records');
              var p1found = false,
                  p2found = false,
                  p3found = false;
              records.forEach(function(p) {
                if (p.id === 1) p1found = true;
                if (p.id === 2) p2found = true;
                if (p.id === 3) p3found = true;
                test.equal(p.constructor, WormRecord, 'Records should be instances of WormRecord');
              });
              test.ok(p1found, 'p1 should have been loaded');
              test.ok(p2found, 'p2 should have been loaded');
              test.ok(p3found, 'p3 should have been loaded');

              test.done();
            });

          });
        });
      });
    });
  },

  'test instance methods': function(test) {
    var AMethod = worm.define('AMethod', {
      structure: {
        version1: function() {
          this.addColumn('foo', MySqlWorm.TEXT);
          this.addColumn('bar', { type: MySqlWorm.INT, default: 0 });
        }
      },
      instanceMethods: {
        getFooGoo: function() {
          return this.foo + '-goo';
        },
        addToBar: function(val) {
          this.bar += val;
        }
      }
    });

    var m1 = new AMethod({ foo: 'no' });
    test.equal(m1.getFooGoo.constructor, Function, 'getFooGoo should be an instance method');
    test.equal(m1.getFooGoo(), 'no-goo', 'should return gooed foo');

    m1.addToBar(4);
    test.equal(m1.bar, 4, 'm1.bar should now be 4');
    m1.addToBar(19);
    test.equal(m1.bar, 23, 'm1.bar should now be 23');

    test.done();
  },

  'test regex validation': function(test) {
    client.query(SQL_TABLE_A_METHOD, function(err) {
      if (err) console.log(err);
      var AMethod = worm.define('AMethod', {
        structure: {
          version1: function() {
            this.addColumn('hello', {
              type:     MySqlWorm.TEXT, // it's a string
              validate: /^hel*o$/i,     // this is to verify
              notEmpty: true            // may not be empty
            });
            this.addColumn('withNumber', { type: MySqlWorm.TEXT, validate: /[0-9]/ });
            this.addColumn('all', { type: MySqlWorm.TEXT });
          }
        }
      });

      var m1 = new AMethod({ hello: 'Heiko' });
      m1.save(function(err, m1too) {
        test.equal(err.name, 'ValidationError', 'Should trigger a validation error');
        test.equal(err.data.length, 1, 'one field should be errornous');
        test.equal(err.data[0], 'hello', 'hello should be the error triggering field');
        test.equal(m1, m1too, 'the object should be passed to the save,');

        m1.hello = 'Heo';
        m1.save(function(err, m1too) {
          test.equal(err, null, 'should work now, because all can either be empty or must fulfill the regex');
          test.equal(m1, m1too, 'the object should be passed to the save,');

          var m2 = new AMethod({
            withNumber: 'nope'
          });
          m2.save(function(err) {
            test.equal(err.name, 'ValidationError', 'Should trigger a validation error, because it may not be empty');
            test.equal(err.data.length, 2, 'two field should be errornous');
            test.ok(err.data.indexOf('hello') > -1, 'hello should be errornous');
            test.ok(err.data.indexOf('withNumber') > -1, 'withNumber should be errornous');

            m2.hello = 'hellllllllllllllo';
            m2.save(function(err) {
              test.equal(err.name, 'ValidationError', 'Should trigger a validation error, because it may not be empty');
              test.equal(err.data.length, 1, 'one field should be errornous');
              test.equal(err.data[0], 'withNumber', 'withNumber should be the error triggering field');

              m2.withNumber = 'nope1';
              m2.save(function(err, m2too) {
                test.equal(err, null, 'should work');
                test.equal(m2, m2too, 'm2 should be passed to save callback');
              });
              test.done();
            });
          });
        });
      });
    });
  },
  'test validation with functions': function(test) {
    client.query(SQL_TABLE_A_METHOD, function(err) {
      if (err) console.log(err);
      var AMethod = worm.define('AMethod', {
        structure: {
          version1: function() {
            this.addColumn('hello', {
              type:     MySqlWorm.TEXT, // it's a string
              validate: function(v) { return (/^hel*o$/i).test(v); }, // this is to verify
              notEmpty: true            // may not be empty
            });
            this.addColumn('withNumber', { type: MySqlWorm.TEXT, validate: function(v) {return v < 13; } });
            this.addColumn('all', { type: MySqlWorm.TEXT });
          }
        }
      });

      var m1 = new AMethod({ hello: 'Heiko' });
      m1.save(function(err, m1too) {
        test.equal(err.name, 'ValidationError', 'Should trigger a validation error');
        test.equal(err.data.length, 1, 'one field should be errornous');
        test.equal(err.data[0], 'hello', 'hello should be the error triggering field');
        test.equal(m1, m1too, 'the object should be passed to the save,');

        m1.hello = 'Heo';
        m1.save(function(err, m1too) {
          test.equal(err, null, 'should work now, because hello can either be empty or must fulfill the regex');
          test.equal(m1, m1too, 'the object should be passed to the save,');

          var m2 = new AMethod({
            withNumber: 13
          });
          m2.save(function(err) {
            test.equal(err.name, 'ValidationError', 'Should trigger a validation error, because it may not be empty');
            test.equal(err.data.length, 2, 'two field should be errornous');
            test.ok(err.data.indexOf('hello') > -1, 'hello should be errornous');
            test.ok(err.data.indexOf('withNumber') > -1, 'withNumber should be errornous');

            m2.hello = 'hellllllllllllllo';
            m2.save(function(err) {
              test.equal(err.name, 'ValidationError', 'Should trigger a validation error, because it may not be empty');
              test.equal(err.data.length, 1, 'one field should be errornous');
              test.equal(err.data[0], 'withNumber', 'withNumber should be the error triggering field');

              m2.withNumber = 12;
              m2.save(function(err, m2too) {
                test.equal(err, null, 'should work');
                test.equal(m2, m2too, 'm2 should be passed to save callback');
              });
              test.done();
            });
          });
        });
      });
    });
  },

  'test datetime': function(test) {
    client.query(SQL_TABLE_TIMETEST, function(err) {
      if (err) console.log(err);
      var Test = worm.define('Timetest', {
        structure: {
          version1: function() {
            this.addColumn('title', {
              type: MySqlWorm.STRING,
              onSave: function(v) { return v || 'no title'; },
              onLoad: function(v) { return v + '-' + v; }
            });
            this.addColumn('time', { type: MySqlWorm.DATETIME }); // should have a default onSave and onLoad method
          }
        }
      });

      var now    = new Date(),
          t1     = new Test({ time: now }),
          tEmpty = new Test(),
          dateTimeString = WormHelpers.dateToDateTime(now);
      test.equal(t1.time.constructor, Date, 'should be a Date object');
      test.equal(t1.getAttribute('time').constructor, Date, 'should also be saved as a Date object');
      
      test.equal(t1.title, null, 'There should be not title set bevor saving');
      t1.save(function(err) {
        test.equal(err, null);
        
        test.equal(t1.title, null, 'The onSave result should only be saved to db, not change the object itself');
        
        Test.find(t1.id, function(err, t2) {
          test.equal(err, null);

          test.equal(t2.time.constructor, Date, 'stored value should retrieved again be a Date object');
          test.equal(t2.time.toString(), now.toString(), 'should be the same Time');
          test.equal(t2.title, 'no title-no title', 'The result should be altered by the onload');

          //TODO onSave: and  onLoad: methods
          client.query("SELECT * FROM Timetests", function(err, rows) {
            test.equal(rows.length, 1, 'There should be only one row');
            test.equal(rows[0].title, 'no title', 'Should be the onSave changed Value');
            // the mysql-native-driver makes a date object out of it?
            //test.equal(rows[0].time, dateTimeString, 'The time should be saved in a DateTime format');
            test.equal(rows[0].time.constructor, Date, 'The time should be saved in a DateTime format');

            // Test the same with record that has already an ID
            t1.time = new Date(2000, 4, 31, 23, 59, 59);
            t1.save(function(err) {
              test.equal(err, null);

              test.equal(t1.title, null, 'The onSave result should only be saved to db, not change the object itself');

              Test.find(t1.id, function(err, t2) {
                test.equal(err, null);

                //TODO onSave: and  onLoad: methods
                client.query("SELECT * FROM Timetests", function(err, rows) {
                  test.equal(rows.length, 1, 'There should still be only one row');
                  // the mysql-native-driver makes a date object out of it?
//                  test.equal(rows[0].time, '2000-5-31 23:59:59', 'The time should be saved in a DateTime format');
                  test.equal(rows[0].time.constructor, Date, 'The time should be saved in a DateTime format');

                  test.doesNotThrow(function() {
                    tEmpty.save();
                  }, 'No time should not be a problem');

                  test.done();
                });
              });
            });

          });
        });
      });
    });
  },

  'test removing a record': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project'),
          p1      = new Project({ title: 'one' }),
          p2      = new Project({ title: 'two' });

      p1.save(function(err) {
        p2.save(function(err) {
          client.query("SELECT * FROM Projects", function(err, rows) {
            test.equal(rows.length, 2, 'There should be two rows in database');

            p1.remove(function(err, project1) {
              test.equal(err, null);

              test.equal(project1, p1, 'The callback params should be like in save');
              test.equal(p1.id, null, 'Record should not have an id anymore')
              test.equal(project1.id, null, 'Record should not have an id anymore')
              test.ok(p1.isDeleted, 'Record should be marked as deleted')
              client.query("SELECT * FROM Projects", function(err, rows) {
                test.equal(rows.length, 1, 'There should now be only one row in db');
                test.equal(rows[0].projectId, p2.id, 'Only the second item should be there');

                test.done();
              });
            });
          });
        });
      });
    });
  },

  'test removing a record with class method': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project'),
          p1      = new Project({ title: 'one' }),
          p2      = new Project({ title: 'two' });

      p1.save(function(err) {
        p2.save(function(err) {
          client.query("SELECT * FROM Projects", function(err, rows) {
            test.equal(rows.length, 2, 'There should be two rows in database');

            Project.remove(1, function(err, rowCount) {
              test.equal(err, null);
              test.equal(rowCount, 1, 'One row should have been deleted');

              client.query("SELECT * FROM Projects", function(err, rows) {
                test.equal(rows.length, 1, 'There should now be only one row in db');
                test.equal(rows[0].projectId, p2.id, 'Only the second item should be there');

                test.done();
              });
            });
          });
        });
      });
    });
  },

  'test removing all records': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project'),
          p1      = new Project({ title: 'one' }),
          p2      = new Project({ title: 'two' }),
          p3      = new Project({ title: 'three' });

      p1.save(function(err) {
        p2.save(function(err) {
          p3.save(function(err) {
            client.query("SELECT * FROM Projects", function(err, rows) {
              test.equal(rows.length, 3, 'There should be three rows in database');

              Project.remove(function(err, rowCount) {
                test.equal(err, null);
                test.equal(rowCount, 3, 'Three rows should have been deleted');

                client.query("SELECT * FROM Projects", function(err, rows) {
                  test.equal(rows.length, 0, 'There should now be no records in db anymore');

                  test.done();
                });
              });
            });
          });
        });
      });
    });
  },

  'test Record.findAllAsHash': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project'),
          p1      = new Project({ title: 'one' }),
          p2      = new Project({ title: 'two' }),
          p3      = new Project({ title: 'three' });

      p1.save(function(err) {
        p2.save(function(err) {
          p3.save(function(err) {
            Project.findAllAsHash(function(err, projects) {
              test.equal(projects.constructor, Object, 'Should be an object with ids as keys');
              test.equal(Object.keys(projects).length, 3, 'There should be three projects');
              test.equal(projects[1].title, 'one', 'Id 1 should be p1');
              test.equal(projects[2].title, 'two', 'Id 2 should be p2');
              test.equal(projects[3].title, 'three', 'Id 3 should be p3');
              test.equal(projects[1].constructor, WormRecord, 'Should have got objects of type WormRecords');
              test.equal(projects[2].constructor, WormRecord, 'Should have got objects of type WormRecords');
              test.equal(projects[3].constructor, WormRecord, 'Should have got objects of type WormRecords');

              test.done();
            });
          });
        });
      });
    });
  },

  'test Record.queryAllAsHash': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'Dancing' })
      ,   p2      = new Project({ title: 'Speaking', description: 'Hey you!' })
      ,   p3      = new Project({ title: 'Watching Movies', description: 'The Dark Knight' });

      p1.save(function(err) {
        test.equal(err, null);
        p2.save(function(err) {
          test.equal(err, null);
          p3.save(function(err) {
            test.equal(err, null);

            Project.queryAllAsHash("SELECT * FROM Projects WHERE projectId>1 ORDER BY projectId ASC", function(err, projects) {
              test.equal(err, null);

              test.equal(projects.constructor, Object, 'Should be an object with ids as keys');
              test.equal(Object.keys(projects).length, 2, 'Should have got two projects');
              test.equal(projects[2].constructor, WormRecord, 'Should have got objects of type WormRecords');
              test.equal(projects[3].constructor, WormRecord, 'Should have got objects of type WormRecords');
              test.equal(projects[2].title, 'Speaking', 'Should be the second saved project');
              test.equal(projects[3].title, 'Watching Movies', 'Should be the third saved project');

                // Test the same with different parameters
                Project.queryAllAsHash("SELECT * FROM Projects WHERE projectId>? ORDER BY projectId ASC", [ 1 ], function(err, projects) {
                test.equal(err, null);

                test.equal(projects.constructor, Object, 'Should be an object with ids as keys');
                test.equal(Object.keys(projects).length, 2, 'Should have got two projects');
                test.equal(projects[2].constructor, WormRecord, 'Should have got objects of type WormRecords');
                test.equal(projects[3].constructor, WormRecord, 'Should have got objects of type WormRecords');
                test.equal(projects[2].title, 'Speaking', 'Should be the second saved project');
                test.equal(projects[3].title, 'Watching Movies', 'Should be the third saved project');

                test.done();
              });
            });
          });
        });
      });
    });
  },

  'test Record.save([r1, r2])': function(test) {
    client.query(SQL_TABLE_PROJECTS, function(err) {
      if (err) console.log(err);

      var Project = worm.getModel('Project')
      ,   p1      = new Project({ title: 'Dancing' })
      ,   p2      = new Project({ title: 'Speaking', description: 'Hey you!' })
      ,   p3      = new Project({ title: 'Watching Movies', description: 'The Dark Knight' });

      Project.save([ p1, p2, p3 ], function(err, projects) {
        test.equal(err, null);

        test.equal(projects.length, 3, 'Should return all saved projects immediately');
        test.equal(projects[0].title, 'Dancing', 'Should be the first one of given params');

        Project.findAllAsHash(function(err, projects) {
          test.equal(err, null);

          test.equal(projects[1].title, 'Dancing', 'Should have saved all items');
          test.equal(projects[2].title, 'Speaking', 'Should have saved all items');
          test.equal(projects[3].title, 'Watching Movies', 'Should have saved all items');

          test.done();
        });
      });
    });
  },

  'test Record.save([r1, r2]) with failing items': function(test) {
    client.query(SQL_TABLE_A_METHOD, function(err) {
      if (err) console.log(err);

      var AMethod = worm.define('AMethod', {
        structure: {
          version1: function() {
            this.addColumn('hello', {
              type:     MySqlWorm.TEXT, // it's a string
              validate: function(v) { return (/^h/i).test(v); }, // this is to verify
              notEmpty: true            // may not be empty
            });
          }
        }
      })
      ,   a1      = new AMethod({ hello: 'Hi' })
      ,   a2      = new AMethod({ hello: 'Tag' })
      ,   a3      = new AMethod({ hello: 'Hola' });

      AMethod.save([ a1, a2, a3 ], function(err, items) {
        test.equal(err.constructor, Array, 'Should return an array of errors');

        test.equal(err[0].name, 'ValidationError', 'Should trigger a validation error');
        test.equal(err[0].data.length, 1, 'one item should be errornous');
        test.equal(err[0].item.constructor, WormRecord, 'should return the Record object that was not successfully saved.');
        test.equal(err[0].item.hello, 'Tag', 'The second one was not saved');
        test.equal(err[0].data[0], 'hello', 'hello should be the error triggering field');

        test.equal(items.length, 2, 'Should return all saved items immediately');
        test.equal(items[0].hello, 'Hi', 'Should be the first one of given params');
        test.equal(items[1].hello, 'Hola', 'Should be the first one of given params');

        AMethod.findAll(function(err, items) {
          test.equal(items.length, 2, 'Should have loaded all two saved items');

          test.equal(items[0].hello, 'Hi', 'Should be the first one of given params');
          test.equal(items[1].hello, 'Hola', 'Should be the first one of given params');

          test.done();
        });
      });
    });
  }
});
