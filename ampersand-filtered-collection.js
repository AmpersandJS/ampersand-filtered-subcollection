/*$AMPERSAND_VERSION*/
var contains = require('amp-contains');
var difference = require('amp-difference');
var each = require('amp-each');
var every = require('amp-every');
var extend = require('amp-extend');
var isArray = require('amp-is-array');
var isEqual = require('amp-is-object-equal');
var keys = require('amp-keys');
var reduce = require('amp-reduce');
var sortedInsert = require('amp-sorted-insert');
//var sortBy = require('amp-sort-by');
var sortBy = require('underscore').sortBy;
//var union = require('amp-union');
var unique = require('amp-unique');
var flatten = require('amp-flatten');

var Events = require('ampersand-events');
var classExtend = require('ampersand-class-extend');
var underscoreMixins = require('ampersand-collection-underscore-mixin');

var slice = Array.prototype.slice;


function FilteredCollection(collection, spec) {
    this.collection = collection;
    this.indexes = collection.indexes;
    this._indexes = {};
    this._resetIndexes(this._indexes);
    this.mainIndex = collection.mainIndex;
    this.models = []; //Our filtered, models
    this.configure(spec || {}, true);
    this.listenTo(this.collection, 'all', this._onCollectionEvent);
}

extend(FilteredCollection.prototype, Events, underscoreMixins, {
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
        if (model && this.contains(model)) return model;
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


    _parseSpec: function (spec) {
        if (spec.watched) this._watch(spec.watched);
        //this.comparator = this.collection.comparator;
        if (spec.comparator) this.comparator = spec.comparator;
        if (spec.where) {
            each(spec.where, function (value, item) {
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
    _watch: function (item) {
        this._watched = unique(flatten([this._watched, item]));
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
            sortedInsert(newModels, model, comparator);
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
        for (var i = 0; i < this.indexes.length; i++) {
            newIndexes[this.indexes[i]] = {};
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

        each(toRemove, function (model) {
            this.trigger('remove', model, this);
        }, this);

        each(toAdd, function (model) {
            this.trigger('add', model, this);
        }, this);

        // unless we have the same models in same order trigger `sort`
        if (!isEqual(existingModels, newModels) && this.comparator) {
            this.trigger('sort', this);
        }
    },

    _onCollectionEvent: function (eventName, model, that, options) {
        /*jshint -W030 */
        options || (options = {});
        var accepted;
        var propName = eventName.split(':')[1];
        var action = eventName;
        var alreadyHave = this._indexedGet(model);
        //Whether or not we are to expect a sort event from our collection later
        var sortable = this.collection.comparator && (options.at == null) && (options.sort !== false);
        var add = options.add;
        var remove = options.remove;
        var ordered = !sortable && add && remove;

        if (
            (propName !== undefined && propName === this.comparator) ||
            contains(this._watched, propName)
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
        }

        // action has now passed the filters

        if (action === 'reset') return this._runFilters();

        if (action === 'add') {
            if (this.models.length === 0) {
                this._runFilters();
            } else {
                this._addModel(model, options, eventName);
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

        if (action !== 'ignore') this.trigger.apply(this, arguments);

        //If we were asked to sort, or we aren't gonna get a sort later and had a sortable property change
        if (action === 'sort' || (propName && !sortable && contains([this.comparator, this.collection.comparator]), propName))
       {
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

FilteredCollection.extend = classExtend;

module.exports = FilteredCollection;
