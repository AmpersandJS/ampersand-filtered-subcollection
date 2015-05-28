/*$AMPERSAND_VERSION*/
var includes = require('lodash.includes');
var difference = require('lodash.difference');
var forEach = require('lodash.foreach');
var every = require('lodash.every');
var assign = require('lodash.assign');
var isArray = require('lodash.isarray');
var isEqual = require('lodash.isequal');
var keys = require('lodash.keys');
var reduce = require('lodash.reduce');
var sortBy = require('lodash.sortby');
var sortedIndex = require('lodash.sortedindex');
var union = require('lodash.union');
var classExtend = require('ampersand-class-extend');
var Events = require('ampersand-events');

var slice = Array.prototype.slice;


function FilteredCollection(collection, spec) {
    this.collection = collection;
    this.indexes = collection.indexes || [];
    this._indexes = {};
    this._resetIndexes(this._indexes);
    this.mainIndex = collection.mainIndex;
    this.models = []; //Our filtered, models
    this.configure(spec || {}, true);
    this.listenTo(this.collection, 'all', this._onCollectionEvent);
}

assign(FilteredCollection.prototype, Events, {
    // Public API

    // add a filter function directly
    addFilter: function (filter) {
        this.swapFilters([filter], []);
    },

    // remove filter function directly
    removeFilter: function (filter) {
        this.swapFilters([], [filter]);
    },

    // clears filters fires events for each add/remove
    clearFilters: function () {
        this._resetFilters();
        this._runFilters();
    },

    // Swap out a set of old filters with a set of
    // new filters
    swapFilters: function (newFilters, oldFilters) {
        var self = this;

        if (!oldFilters) {
            oldFilters = this._filters;
        } else if (!isArray(oldFilters)) {
            oldFilters = [oldFilters];
        }

        if (!newFilters) {
            newFilters = [];
        } else if (!isArray(newFilters)) {
            newFilters = [newFilters];
        }

        oldFilters.forEach(function (filter) {
            self._removeFilter(filter);
        });

        newFilters.forEach(function (filter) {
            self._addFilter(filter);
        });

        this._runFilters();
    },

    // Update config with potentially new filters/where/etc
    configure: function (opts, clear) {
        if (clear) this._resetFilters(clear);
        this._parseSpec(opts);
        if (clear) this._runFilters();
    },

    // gets a model at a given index
    at: function (index) {
        return this.models[index];
    },

    // proxy `get` method to the underlying collection
    get: function (query, indexName) {
        var model = this.collection.get(query, indexName);
        if (model && includes(this.models, model)) return model;
    },

    // clear all filters, reset everything
    reset: function () {
        this.configure({}, true);
    },

    // Internal API

    // try to get a model by index
    _indexedGet: function (query, indexName) {
        if (!query) return;
        var index = this._indexes[indexName || this.mainIndex];
        return index[query] || index[query[this.mainIndex]] || this._indexes.cid[query] || this._indexes.cid[query.cid];
    },

    _contains: function (model) {
        return this.models.indexOf(model) !== -1;
    },

    _parseSpec: function (spec) {
        if (spec.watched) this._watch(spec.watched);
        //this.comparator = this.collection.comparator;
        if (spec.comparator) this.comparator = spec.comparator;
        if (spec.where) {
            forEach(spec.where, function (value, item) {
                this._addFilter(function (model) {
                    return (model.get ? model.get(item) : model[item]) === value;
                });
            }, this);
            // also make sure we watch all `where` keys
            this._watch(keys(spec.where));
        }
        if (spec.filter) {
            this._addFilter(spec.filter);
        }
        if (spec.filters) {
            spec.filters.forEach(this._addFilter, this);
        }
    },
    // internal method registering new filter function
    _addFilter: function (filter) {
        this._filters.push(filter);
    },

    // remove filter if found
    _removeFilter: function (filter) {
        var index = this._filters.indexOf(filter);
        if (index !== -1) {
            this._filters.splice(index, 1);
        }
    },

    // just reset filters, no model changes
    _resetFilters: function (resetComparator) {
        this._filters = [];
        this._watched = [];
        if (resetComparator) this.comparator = undefined;
    },

    // adds a property or array of properties to watch, ensures uniquness.
    _watch: function (items) {
        this._watched = union(this._watched, items);
    },

    // removes a watched property
    _unwatch: function (item) {
        this._watched = difference(this._watched, isArray(item) ? item : [item]);
    },

    _sortModels: function (newModels) {
        var comparator = this.comparator || this.collection.comparator;
        if (comparator) {
            newModels = sortBy(newModels, comparator);
        } else {
            // This only happens when parent got a .set with options.at defined
            this._runFilters();
        }
        return newModels;
    },

    //Add a model to this filtered collection that has already passed the filters
    _addModel: function (model, options, eventName) {
        var newModels = slice.call(this.models);
        var comparator = this.comparator || this.collection.comparator;
        //Whether or not we are to expect a sort event from our collection later
        var sortable = eventName === 'add' && this.collection.comparator && (options.at == null) && options.sort !== false;
        if (!sortable) {
            var index = sortedIndex(newModels, model, comparator);
            newModels.splice(index, 0, model);
        } else {
            newModels.push(model);
            if (options.at) newModels = this._sortModels(newModels);
        }

        this.models = newModels;
        this._addIndex(this._indexes, model);
        if (this.comparator && !sortable) {
            this.trigger('sort', this);
        }
    },

    //Remove a model if it's in this filtered collection
    _removeModel: function (model) {
        var newModels = slice.call(this.models);
        var modelIndex = newModels.indexOf(model);
        if (modelIndex > -1) {
            newModels.splice(modelIndex, 1);
            this.models = newModels;
            this._removeIndex(this._indexes, model);
            return true;
        }
        return false;
    },


    //Test if a model passes our filters
    _testModel: function (model) {
        if (this._filters.length === 0) {
            return true;
        }
        return every(this._filters, function (filter) {
            return filter(model);
        });
    },

    _addIndex: function (newIndexes, model) {
        for (var name in this._indexes) {
            var indexVal = model[name] || (model.get && model.get(name));
            if (indexVal) newIndexes[name][indexVal] = model;
        }
    },

    _removeIndex: function (newIndexes, model) {
        for (var name in this._indexes) {
            delete this._indexes[name][model[name] || (model.get && model.get(name))];
        }
    },

    _resetIndexes: function (newIndexes) {
        var list = slice.call(this.indexes);
        list.push(this.mainIndex);
        list.push('cid');
        for (var i = 0; i < list.length; i++) {
            newIndexes[list[i]] = {};
        }
    },

    // Re-run the filters on all our parent's models
    _runFilters: function () {
        // make a copy of the array for comparisons
        var existingModels = slice.call(this.models);
        var rootModels = slice.call(this.collection.models);
        var newIndexes = {};
        var newModels, toAdd, toRemove;

        this._resetIndexes(newIndexes);

        // reduce base model set by applying filters
        if (this._filters.length) {
            newModels = reduce(this._filters, function (startingArray, filterFunc) {
                return startingArray.filter(filterFunc);
            }, rootModels);
        } else {
            newModels = slice.call(rootModels);
        }

        // sort it
        if (this.comparator) newModels = sortBy(newModels, this.comparator);

        newModels.forEach(function (model) {
            this._addIndex(newIndexes, model);
        }, this);

        // Cache a reference to the full filtered set to allow this._filtered.length. Ref: #6
        if (rootModels.length) {
            this._filtered = newModels;
            this._indexes = newIndexes;
        } else {
            this._filtered = [];
            this._resetIndexes(this._indexes);
        }

        // now we've got our new models time to compare
        toAdd = difference(newModels, existingModels);
        toRemove = difference(existingModels, newModels);

        // save 'em
        this.models = newModels;

        forEach(toRemove, function (model) {
            this.trigger('remove', model, this);
        }, this);

        forEach(toAdd, function (model) {
            this.trigger('add', model, this);
        }, this);

        // unless we have the same models in same order trigger `sort`
        if (!isEqual(existingModels, newModels) && this.comparator) {
            this.trigger('sort', this);
        }
    },

    _onCollectionEvent: function (event, model, that, options) {
        /*jshint -W030 */
        options || (options = {});
        var accepted;
        var eventName = event.split(':')[0];
        var propName = event.split(':')[1];
        var action = event;
        var alreadyHave = this._indexedGet(model);
        //Whether or not we are to expect a sort event from our collection later
        var sortable = this.collection.comparator && (options.at == null) && (options.sort !== false);
        var add = options.add;
        var remove = options.remove;
        var ordered = !sortable && add && remove;

        if (
            (propName !== undefined && propName === this.comparator) ||
            includes(this._watched, propName)
        ) { //If a property we care about changed
            accepted = this._testModel(model);

            if (!alreadyHave && accepted) {
                action = 'add';
            } else if (alreadyHave && !accepted) {
                action = 'remove';
            } else {
                action = 'ignore';
            }
        } else if (action === 'add') { //See if we really want to add
            if (!this._testModel(model) || alreadyHave) {
                action = 'ignore';
            }
        } else if (eventName === 'change' && !this._contains(model)) {
            //Don't trigger change events that are not from this collection
            action = 'ignore';
        }

        // action has now passed the filters

        if (action === 'reset') return this._runFilters();

        if (action === 'add') {
            if (this.models.length === 0) {
                this._runFilters();
            } else {
                this._addModel(model, options, event);
                this.trigger('add', model, this);
            }
            return;
        }

        if (action === 'remove') {
           if (this._removeModel(model)) {
               this.trigger('remove', model, this);
           }
           return;
        }

        if (action !== 'ignore') {
          this.trigger.apply(this, arguments);
        }

        //If we were asked to sort, or we aren't gonna get a sort later and had a sortable property change
        if (
            action === 'sort' ||
            (propName && !sortable && includes([this.comparator, this.collection.comparator], propName))
        ) {
            if (ordered && model.isNew) return; //We'll get a sort later
            this.models = this._sortModels(this.models);
            if (this.comparator && action !== 'sort') {
                this.trigger('sort', this);
            }
        }

    }

});

Object.defineProperty(FilteredCollection.prototype, 'length', {
    get: function () {
        return this.models.length;
    }
});

Object.defineProperty(FilteredCollection.prototype, 'isCollection', {
    get: function () {
        return true;
    }
});

var arrayMethods = [
    'indexOf',
    'lastIndexOf',
    'every',
    'some',
    'forEach',
    'map',
    'filter',
    'reduce',
    'reduceRight'
];

arrayMethods.forEach(function (method) {
    FilteredCollection.prototype[method] = function () {
        return this.models[method].apply(this.models, arguments);
    };
});

// alias each/forEach for maximum compatibility
FilteredCollection.prototype.each = FilteredCollection.prototype.forEach;

// methods to copy from parent
var collectionMethods = [
    'serialize',
    'toJSON'
];

collectionMethods.forEach(function (method) {
    FilteredCollection.prototype[method] = function () {
        return this.collection[method].apply(this, arguments);
    };
});

FilteredCollection.extend = classExtend;

module.exports = FilteredCollection;
