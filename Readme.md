# MySQL w(ith) ORM v0.1

## The Mission:

    The mission is to provide a simple to use, lightweight, flexible and extensible object-relation mapper for MySQL databases in Node.js. It should not get in the way, and support your way of coding.

## What is different (in comparison to other ORMs)?

The key difference is, that you should have the ability to write your own queries, if you don't want to rely on those .query('some_tables').where('x>3') promises or if you want something really complicated. For example define your own filter like this:

    Project.findAllWithTenTasks(function(err, myFilteredProjects) {
      // Do stuff with that here
    });

simply through the following definition:

    var Project = mySqlWorm.define('Project', {
      ...
      classMethods: {
        findAllWithTenTasks: function(cb) {
          this.queryAll('SELECT * FROM ' + this.tableName + ' WHERE archived=0 AND tasks>=10', cb);
        }
      }
    });

### Additional goals:

* TDD development - so the code should have a very high test coverage
* stability - it should simply work
* understandability - it should be fairly simple to just get started with using this

## Installation:

For the moment just clone this github repository and have fun.

## Dependencies:

* [node-mysql](https://github.com/felixge/node-mysql) (For now only node-mysql is supported)

## Testing:

The tests are using [nodeunit](https://github.com/caolan/nodeunit).

Just use:

    nodeunit test/*

## TODO:

A lot is still todo. For example (in no specific order):

* Creating table out of the definition (incl. Migrations)
* Validation with custom functions
* Hooks (like save, load) to watch for in and out going stuff
* Later on also transaction support would be nice
* Association tables
* Build documentation

## Changelog:

### 2011-03-13:

* Added remove methods for removing one or all records
* Added onLoad and onSave methods
* Datetime will now be stored right and retrieved as objects of type Date

### 2011-03-10:

* Added possibility to define getter and setter methods on attributes
* Added some tests for defining data structure with iterated versions
* Added .find and .findAll methods for finding all or specific records

### 2011-03-08:

* Added regex validation support

### 2011-03-08: v0.1

* Added support for instance and static methods
* Added query support for getting a set of records

### 2011-03-07:

* Added basic quering support with record creation
* Also added inserting of records into db tables

### 2011-03-05:

* Created infrastructure
