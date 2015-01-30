/*jshint node: true*/
var Collection = require('ampersand-collection');
var SubCollection = require('./ampersand-filtered-collection');
var State = require('ampersand-state');

var collectionSize = 10000;
//var collectionSize = 10;
var i = 0;
var names = ['Cat', 'Dog', 'Turtle', 'Dinosaur', 'Fish', 'Pony', 'Axolotl'];
var itemData = [];

var activeCounter = 0;

var Item = State.extend({
  props: {
    id: i,
    name: 'string',
    active: 'boolean'
  }
});
var Items = Collection.extend({
  model: Item,
  comparator: 'name'
});

var items = new Items();
var activeItems = new SubCollection(items, {
  filter: function (item) {
    activeCounter++;
  	return item.active;
  },
  watched: ['active']
});


for (i = 0;i < collectionSize; i++) {
    itemData.push({
        id: i,
        name: names[i % 5],
        active: Boolean(i % 2), //Half active
    });
}
//console.log('data', itemData);
console.time('using set all at once');
items.set(itemData);
console.timeEnd('using set all at once');
console.log('active ran', activeCounter, 'times');
console.log('items:', collectionSize);
console.log('active:', activeItems.length);
console.log('----------');

activeCounter = 0;
console.time('toggle half actives');
for (i = 0; i < collectionSize; i++) {
   items.at(i).active = false;
}
console.timeEnd('toggle half actives');
console.log('active ran', activeCounter, 'times');
console.log('items:', collectionSize);
console.log('active:', activeItems.length);
console.log('----------');
activeCounter = 0;

console.time('toggle half actives');
for (i = 0; i < collectionSize; i++) {
   items.at(i).active = true;
}
console.timeEnd('toggle half actives');
console.log('active ran', activeCounter, 'times');
console.log('items:', collectionSize);
console.log('active:', activeItems.length);
console.log('----------');
