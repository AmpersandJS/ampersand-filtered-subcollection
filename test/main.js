var test = require('tape');
var Collection = require('ampersand-collection');
var SubCollection = require('../ampersand-filtered-subcollection');
var Model = require('ampersand-state');
var every = require('lodash/every');
var find = require('lodash/find');
var keys = require('lodash/keys');
var map = require('lodash/map');
var toArray = require('lodash/toArray');

// our widget model
var Widget = Model.extend({
    props: {
        id: 'number',
        name: 'string',
        awesomeness: 'number',
        sweet: 'boolean'
    }
});

// our base collection
var Widgets = Collection.extend({
    model: Widget,
    comparator: 'awesomeness'
});

// helper for getting a base collection
function getBaseCollection() {
    var widgets = new Widgets();

    // add a hundred items to our base collection
    var items = 100;
    while (items--) {
        widgets.add({
            id: items,
            name: 'abcdefghij'.split('')[items % 10],
            awesomeness: (items % 10),
            sweet: (items % 2 === 0)
        });
    }
    return widgets;
}

test('basic init, length', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base);
    t.equal(sub.length, 100);
    t.end();
});

test('it should report as being a collection', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base);
    t.ok(sub.isCollection);

    try {
      sub.isCollection = false;
    } catch (e) {
      //It's ok if this throws, the property only has a setter
      //and some browsers (i.e. phantomjs) error on this
    }
    t.ok(sub.isCollection);
    t.end();
});

test('basic `where` filtering', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true
        }
    });
    t.equal(sub.length, 50);
    t.end();
});

test('add a filter after init', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base);
    sub.addFilter(function (model) {
        return model.awesomeness === 5;
    });

    t.equal(sub.length, 10);
    t.end();
});

test('remove a filter', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base);
    var isPartiallyAwesome = function (model) {
        return model.awesomeness === 5;
    };

    sub.addFilter(isPartiallyAwesome);
    t.equal(sub.length, 10);

    sub.removeFilter(isPartiallyAwesome);
    t.equal(sub.length, 100);

    t.end();
});

test('swap filters', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base);
    var isPartiallyAwesome = function (model) {
        return model.awesomeness === 5;
    };
    var isSweet = function (model) {
        return model.sweet;
    };

    sub.addFilter(isPartiallyAwesome);
    t.equal(sub.length, 10);

    sub.swapFilters(isSweet, isPartiallyAwesome);
    t.equal(sub.length, 50);

    t.end();
});

test('swap all filters', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base);
    var isPartiallyAwesome = function (model) {
        return model.awesomeness === 5;
    };
    var isSweet = function (model) {
        return model.sweet;
    };

    sub.addFilter(isPartiallyAwesome);
    t.equal(sub.length, 10);

    sub.swapFilters(isSweet);
    t.equal(sub.length, 50);

    t.end();
});

test('function based filtering', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        filter: function (model) {
            return model.awesomeness > 5;
        }
    });
    t.ok(sub.length > 0, 'should have some that match');
    t.ok(sub.length < 100, 'but not all');
    t.end();
});

test('multiple filter functions', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        filters: [
            function (model) {
                return model.awesomeness > 5;
            },
            function (model) {
                return model.name === 'j';
            }
        ]
    });
    t.equal(sub.length, 10);
    t.end();
});

test('mixed filter and `where`', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        filter: function (model) {
            return model.awesomeness > 5;
        },
        where: {
            name: 'j'
        }
    });
    t.equal(sub.length, 10);
    t.end();
});

test('should sort independent of base', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        comparator: 'id'
    });
    t.equal(sub.length, 100);
    t.notEqual(sub.at(0), base.at(0));
    t.end();
});

test('should fire `add` events only if added items match filter', function (t) {
    t.plan(1);
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        filter: function (model) {
            return model.awesomeness > 5;
        }
    });
    var awesomeWidget = new Widget({
        name: 'awesome',
        id: 999,
        awesomeness: 11,
        sweet: true
    });
    var lameWidget = new Widget({
        name: 'lame',
        id: 1000,
        awesomeness: 0,
        sweet: false
    });
    sub.on('add', function (model) {
        t.equal(model, awesomeWidget);
        t.end();
    });
    base.add([lameWidget, awesomeWidget]);
});

test('should fire `remove` events only if removed items match filter', function (t) {
    t.plan(3);
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        filter: function (model) {
            return model.awesomeness > 5;
        }
    });
    // grab a lame widget
    var lameWidget = find(base.models, function (model) {
        return model.awesomeness < 5;
    });
    // grab an awesome widget
    var awesomeWidget = find(base.models, function (model) {
        return model.awesomeness > 5;
    });
    sub.on('remove', function (model) {
        t.equal(model, awesomeWidget);
        t.end();
    });
    t.ok(awesomeWidget);
    t.ok(lameWidget);
    base.remove([lameWidget, awesomeWidget]);
});

test('should fire `add` and `remove` events after models are updated', function (t) {
    t.plan(2);
    var base = getBaseCollection();
    var sub = new SubCollection(base);
    var awesomeWidget = new Widget({
        name: 'awesome',
        id: 999,
        awesomeness: 11,
        sweet: true
    });
    sub.on('add', function () {
        t.equal(sub.models.length, 101);
    });
    sub.on('remove', function () {
        t.equal(sub.models.length, 100);
        t.end();
    });
    base.add(awesomeWidget);
    base.remove(awesomeWidget);
});

test('make sure changes to `where` properties are reflected in sub collections', function (t) {
    t.plan(3);
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true
        }
    });
    var firstSweet = sub.models[0];
    sub.on('remove', function (model) {
        t.equal(model, firstSweet);
        t.equal(firstSweet.sweet, false);
        t.end();
    });
    t.ok(firstSweet);
    firstSweet.sweet = false;
});

test('should be able to `get` a model by id or other index', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true
        }
    });
    var cool = sub.models[0];
    var lame = find(base.models, function (model) {
        return model.sweet === false;
    });
    // sanity checks
    t.ok(cool.sweet);
    t.notOk(lame.sweet);
    t.ok(sub.models.indexOf(lame) === -1);
    t.ok(base.models.indexOf(lame) !== -1);
    t.notEqual(sub.get(lame.id), lame);
    t.equal(sub.get(cool.id), cool);
    t.end();
});

test('should be able to listen for `change:x` events on subcollection', function (t) {
    t.plan(1);
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true
        }
    });
    sub.on('change:name', function () {
        t.pass('handler called');
        t.end();
    });
    var cool = sub.models[0];
    cool.name = 'new name';
});

test('should be able to listen for general `change` events on subcollection', function (t) {
    t.plan(1);
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true
        }
    });
    sub.on('change', function () {
        t.pass('handler called');
        t.end();
    });
    var cool = sub.models[0];
    cool.name = 'new name';
});

test('have the correct ordering saved when processing a sort event', function (t) {
    t.plan(3);
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true
        },
        comparator: 'name'
    });

    var third = sub.at(40);

    third.sweet = false;

    t.notEqual(third.id, sub.at(40).id);
    t.notOk(sub.get(third.id));

    sub.on('sort', function () {
        t.equal(third.id, sub.at(40).id);
    });

    third.sweet = true;
});

test('reset works correctly/efficiently when passed to configure', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true
        }
    });
    var itemsRemoved = [];
    var itemsAdded = [];

    base.comparator = undefined;

    t.equal(sub.length, 50, 'should be 50 that match initial filter');

    sub.on('remove', function (model) {
        itemsRemoved.push(model);
    });
    sub.on('add', function (model) {
        itemsAdded.push(model);
    });

    var oldResetFilters = sub._resetFilters;
    var resetCalls = [];
    sub._resetFilters = function (resetComparator) {
        resetCalls.push(toArray(arguments));
        oldResetFilters.call(this, resetComparator);
    };

    sub.configure({
        where: {
            sweet: true,
            awesomeness: 6
        }
    }, true);

    t.same(resetCalls[0], [true], 'configure calls _resetFilters(true) when reset is true');
    sub._resetFilters = oldResetFilters;

    t.equal(sub.length, 10, 'should be 10 that match second filter');
    t.equal(itemsRemoved.length, 40, '10 of the items should have been removed');
    t.equal(itemsAdded.length, 0, 'nothing should have been added');
    t.equal(sub.comparator, void 0, 'comparator is reset');

    t.ok(every(itemsRemoved, function (item) {
        return item.sweet === true && item.awesomeness !== 6;
    }), 'every item removed should have awesomeness not 6 and be sweet: true');

    t.end();
});

test('_watched contains members of spec.watched but is not spec.watched', function (t) {
    t.plan(2);
    var watched = ['name', 'awesomeness'];
    var comparator = 'sweet';
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        limit: 10,
        comparator: comparator,
        watched: watched,
        filter: function (item) {
            return item.awesomeness > 5 || item.name > 'd';
        }
    });

    t.notEqual(sub._watched, watched, '_watched should not be the same array as spec.watched');
    t.same(sub._watched, watched, '_watched should contain spec.watched members');
    t.end();
});

test('_resetFilters', function (t) {
    t.plan(6);
    var comparator = 'sweet';
    var where = {
        awesomeness: 5,
        name: 'b'
    };
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        comparator: comparator,
        where: where,
        watched: ['id']
    });

    t.same(sub._watched.sort(), keys(where).concat('id').sort(), '_watched should contain spec.watched members');

    sub._resetFilters();

    t.same(sub._watched, [], '_resetFilters() empties _watched');
    t.same(sub._filters, [], '_resetFilters() empties _filters');
    t.same([sub.offset, sub.limit], [void 0, void 0], '_resetFilters() unsets offset and limit');
    t.equal(sub.comparator, comparator, '_resetFilters() does NOT reset comparator');

    sub._resetFilters(true);

    t.equal(sub.comparator, void 0, '_resetFilters(true) resets comparator to undefined');

    t.end();
});

test('string comparator causes _runFilters to be called when comparator prop changes on models', function (t) {
    t.plan(1);
    var comparator = 'sweet';
    var where = {
        awesomeness: 5,
        name: 'b'
    };
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        comparator: comparator,
        where: where
    });
    var filtersRan = 0;
    sub._runFilters = function () { filtersRan++; };
    sub.models.forEach(function (model) { model.sweet = !model.sweet; });
    t.equal(filtersRan, sub.models.length, '_runFilters called once for each model');
    t.end();
});

test('reset', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true
        },
        comparator: 'id',
        filter: function (model) {
            return model.awesomeness === 6;
        }
    });
    base.comparator = undefined;

    var itemsRemoved = [];
    var itemsAdded = [];
    var sortTriggered = 0;

    t.equal(sub.length, 10, 'should be 10 that match initial filters');

    sub.on('remove', function (model) {
        itemsRemoved.push(model);
    });
    sub.on('add', function (model) {
        itemsAdded.push(model);
    });
    sub.on('sort', function () {
        sortTriggered++;
    });

    sub.reset();

    t.equal(sub.length, base.length, 'should be same as base length');
    t.equal(itemsAdded.length, 90, '90 should have been added back');
    t.equal(itemsRemoved.length, 0, '0 should have been removed');

    t.deepEqual(sub._watched, [], 'should not be watching any properties');
    t.equal(sub.comparator, base.comparator, 'comparator should be reset');
    t.equal(sortTriggered, 0, 'should not have triggered a `sort`');

    t.deepEqual(map(sub.models, 'id'), map(base.models, 'id'), 'base and sub should have same models');

    t.ok(every(itemsAdded, function (item) {
        return item.sweet !== true || item.awesomeness !== 6;
    }), 'every item added back should either not be sweet or have awesomness of 6');

    t.end();
});

test('clear filters', function (t) {
    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true
        },
        comparator: 'id',
        filter: function (model) {
            return model.awesomeness === 6;
        }
    });

    var itemsRemoved = [];
    var itemsAdded = [];
    var sortTriggered = 0;

    t.equal(sub.length, 10, 'should be 10 that match initial filters');

    sub.on('remove', function (model) {
        itemsRemoved.push(model);
    });
    sub.on('add', function (model) {
        itemsAdded.push(model);
    });
    sub.on('sort', function () {
        sortTriggered++;
    });

    sub.clearFilters();

    t.equal(sub.length, base.length, 'should be same as base length');
    t.equal(itemsAdded.length, 90, '90 should have been added back');
    t.equal(itemsRemoved.length, 0, '0 should have been removed');

    t.deepEqual(sub._watched, [], 'should not be watching any properties');
    t.equal(sub.comparator, 'id', 'should still have comparator');
    t.equal(sortTriggered, 1, 'should trigger `sort` for renderers sake');

    t.ok(every(itemsAdded, function (item) {
        return item.sweet !== true || item.awesomeness !== 6;
    }), 'every item added back should either not be sweet or have awesomness of 6');

    t.end();
});

test('custom event bubbling', function (t) {

    var base = getBaseCollection();
    var sub = new SubCollection(base, {
        where: {
            sweet: true,
            awesomeness: 6
        }
    });

    var customCountBase = 0;
    base.on('custom', function () {
        customCountBase++;
    });

    var customCountSub = 0;
    sub.on('custom', function () {
        customCountSub++;
    });

    var model = sub.at(0);
    model.trigger('custom', model);

    t.equal(customCountBase, 1, 'base event triggered');
    t.equal(customCountSub, 1, 'sub event triggered');
    t.equal(customCountBase, customCountSub, 'sub bubbled custom event');

    t.end();
});

test('Serialize/toJSON method', function (t) {
    var c = new Collection();
    var sub = new SubCollection(c);
    c.set([{id: 'thing'}, {id: 'other'}]);
    t.deepEqual([{id: 'thing'}, {id: 'other'}], sub.serialize());
    t.equal(JSON.stringify([{id: 'thing'}, {id: 'other'}]), JSON.stringify(sub));
    t.end();
});

test('doesn\'t bubble \'change\' events that are not from the filtered collection', function (t) {
    var M = Model.extend({
        props: {
            prop: 'number'
        }
    });
    var c = new Collection([
        new M({prop: 0}),
        new M({prop: 10})
    ]);
    var sub = new SubCollection(c, {
        where: {
            prop: 0
        }
    });
    sub.on('change', function () {
        t.fail('sub bubbled change event of model not in sub');
    });
    c.on('change', function () {
        t.pass('collection triggered change event');
    });
    c.models[1].prop = 11;
    t.end();
});

test('doesn\'t bubble \'change:derivedProperty\' events that are not from the filtered collection', function (t) {
    var M = Model.extend({
        props: {
            prop: 'number'
        },
        derived: {
            derivedProperty: {
                deps: ['prop'],
                fn: function () { return 123; }
            }
        }
    });
    var c = new Collection([
        new M({prop: 0}),
        new M({prop: 10})
    ]);
    var sub = new SubCollection(c, {
        where: {
            prop: 0
        }
    });
    sub.on('change:derivedProperty', function () {
        t.fail('sub bubbled change:derviedProperty event of model not in sub');
    });
    c.on('change:derivedProperty', function () {
        t.pass('collection triggered change:derivedProperty event');
    });
    c.models[1].prop = 11;
    t.end();
});

test('sort by string', function (t) {
    var M = Model.extend({ props: { prop: 'number' } });
    var m1 = new M({prop: 1});
    var m2 = new M({prop: 2});
    var m3 = new M({prop: 3});
    var c = new Collection([m2, m3, m1]);
    var sub = new SubCollection(c, {
        comparator: 'prop'
    });
    t.deepEqual(map(sub.models, 'prop'), [1, 2, 3]);
    t.end();
});

test('sort by string when property changes', function (t) {
    var M = Model.extend({ props: { prop: 'number' } });
    var m1 = new M({prop: 1});
    var m2 = new M({prop: 2});
    var m3 = new M({prop: 3});
    var c = new Collection([m2, m3, m1]);
    var sub = new SubCollection(c, {
        comparator: 'prop'
    });
    m1.prop = 4;
    t.deepEqual(map(sub.models, 'prop'), [2, 3, 4]);
    t.end();
});

test('sort by 1 argument function', function (t) {
    var M = Model.extend({ props: { prop: 'number' } });
    var m1 = new M({prop: 1});
    var m2 = new M({prop: 2});
    var m3 = new M({prop: 3});
    var c = new Collection([m2, m3, m1]);
    var sub1 = new SubCollection(c, {
        comparator: function (model) {
            return 0 - model.prop;
        },
    });
    var sub2 = new SubCollection(c, {
        comparator: function (model) {
            return model.prop;
        },
    });
    t.deepEqual(map(sub1.models, 'prop'), [3, 2, 1]);
    t.deepEqual(map(sub2.models, 'prop'), [1, 2, 3]);
    t.end();
});

test('sort by 1 argument function when property changes', function (t) {
    var M = Model.extend({ props: { prop: 'number' } });
    var m1 = new M({prop: 1});
    var m2 = new M({prop: 2});
    var m3 = new M({prop: 3});
    var c = new Collection([m2, m3, m1]);
    var sub = new SubCollection(c, {
        comparator: function (model) {
            return model.prop;
        },
        watched: ['prop'],
    });
    t.deepEqual(map(sub.models, 'prop'), [1, 2, 3]);
    m1.prop = 4;
    t.deepEqual(map(sub.models, 'prop'), [2, 3, 4]);
    t.end();
});

test('sort by 2 argument function', function (t) {
    var M = Model.extend({ props: { prop: 'number' } });
    var m1 = new M({prop: 1});
    var m2 = new M({prop: 2});
    var m3 = new M({prop: 3});
    var c = new Collection([m2, m3, m1]);
    var sub1 = new SubCollection(c, {
        comparator: function (a, b) {
            return a.prop - b.prop;
        },
    });
    var sub2 = new SubCollection(c, {
        comparator: function (a, b) {
            return b.prop - a.prop;
        },
    });
    t.deepEqual(map(sub1.models, 'prop'), [1, 2, 3]);
    t.deepEqual(map(sub2.models, 'prop'), [3, 2, 1]);
    t.end();
});

test('sort by 2 argument function when property changes', function (t) {
    var M = Model.extend({ props: { prop: 'number' } });
    var m1 = new M({prop: 1});
    var m2 = new M({prop: 2});
    var m3 = new M({prop: 3});
    var c = new Collection([m2, m3, m1]);
    var sub = new SubCollection(c, {
        comparator: function (a, b) {
            return a.prop - b.prop;
        },
        watched: ['prop'],
    });
    t.deepEqual(map(sub.models, 'prop'), [1, 2, 3]);
    m1.prop = 4;
    t.deepEqual(map(sub.models, 'prop'), [2, 3, 4]);
    t.end();
});

test('listens to comparator property change event', function (t) {
    var M = Model.extend({ props: { prop: 'number' } });
    var c = new Collection([
        new M({prop: 3}),
        new M({prop: 1}),
        new M({prop: 2})
    ]);
    var sub = new SubCollection(c, {
        comparator: 'prop'
    });
    sub.on('change:prop', function () {
        t.pass('Change triggered');
        t.end();
    });
    sub.models[0].prop = 10;
});
