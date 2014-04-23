## Backbone.Events
好吧，先来从宏观上介绍下Backbone.Events对象，该对象的实现还算比较简单。
事件的绑定方法有on, once, listenTo, listenOnce
事件的注销方法有off, stopListening
事件的触发方法有trigger
底下干活的私有方法有eventsApi, triggerEvents
那么，这些家伙是如何工作的呢。首先我们说说事件的绑定，虽然绑定事件有4个方法，但是通过源码我们知道，最终工作的都是on。这么看来on真是一个勤快的小伙伴，那么on是如何工作的呢？因为on支持多种参数的写法，所以在一开始他会找他背后的情人eventsApi去帮他处理事件名的不同写法，处理后成最基本的写法再交给on来做。难怪人们说每个成功男人背后都有一个能顶半边天的女人。那么eventsApi帮他处理好不同eventName写法后，他自己也会再审核一次，并且会对其它参数进行响应的判断处理。然后创建一个对象用来存放所有被注册的事件监听器，进行统一的管理。这个对象的结构如下：
```
Events._events = {
  change: [
    {
      callback: callback1,
      context: context,
      ctx: context || this
    },
    ....
  ],
  blur: [...]
  ...
}
```
当这个对象创建完，或者已经存在了。把相应的callback，context构建成一个对象，push到events[even]数组中，事件监听器的注册就算完成了，是不是很简单。

once, listenTo, listenToOnce相对on只是在调用on之前进行了一些特殊的操作。比较不同的是，listenTo, listenToOnce注册事件保存的是对象，通过uniqueId索引
```
Events._listeningTo = {
  uniqueId1: {
    ...
    _events: {
      eventName: [
        {
          ...
        }
      ],
      ...
    },
    ..
  },
  uniqueId2: obj2,
  ...
}
```

接下来，介绍下事件的触发trigger，trigger一开始同样是调用小情人eventsApi处理eventName参数。然后调用私有函数triggerEvents去取我们注册的时候存到_events里面的callback。这里需要注意的就是，如果我们注册了'all'事件，那么在触发任何事件的时候，'all'下面的callback都会被触发。

最后，介绍事件的注销，通过事件注册，触发的介绍，各位应该也清楚如何注销事件了。从_events里面删除响应的属性就行了嘛！

### Catalog of Events 
Here's the complete list of built-in Backbone events, with arguments. You're also free to trigger your own events on Models, Collections and Views as you see fit. The Backbone object itself mixes in Events, and can be used to emit any global events that your application needs.
```
"add" (model, collection, options) — when a model is added to a collection.
"remove" (model, collection, options) — when a model is removed from a collection.
"reset" (collection, options) — when the collection's entire contents have been replaced.
"sort" (collection, options) — when the collection has been re-sorted.
"change" (model, options) — when a model's attributes have changed.
"change:[attribute]" (model, value, options) — when a specific attribute has been updated.
"destroy" (model, collection, options) — when a model is destroyed.
"request" (model_or_collection, xhr, options) — when a model or collection has started a request to the server.
"sync" (model_or_collection, resp, options) — when a model or collection has been successfully synced with the server.
"error" (model_or_collection, resp, options) — when model's or collection's request to remote server has failed.
"invalid" (model, error, options) — when a model's validation fails on the client.
"route:[name]" (params) — Fired by the router when a specific route is matched.
"route" (route, params) — Fired by the router when any route has been matched.
"route" (router, route, params) — Fired by history when any route has been matched.
"all" — this special event fires for any triggered event, passing the event name as the first argument.
```
Generally speaking, when calling a function that emits an event (model.set, collection.add, and so on...), if you'd like to prevent the event from being triggered, you may pass {silent: true} as an option. Note that this is rarely, perhaps even never, a good idea. Passing through a specific flag in the options for your event callback to look at, and choose to ignore, will usually work out better.


### Events.on
#### Usage
```javascript
1. obj.on('eventName', callback[, context]);
2. obj.on('eventName1 eventName2', callback[, context]);
3. obj.on({
  'eventName1': callback1,
  'eventName2': callback2
}[, context]);
```
#### Explain
Events.on方法有三种参数写法，如上。on的工作流程很简单：
```javascript
on: function(name, callback, context) {
  // 调用私有方法eventsApi对参数进行处理，如果是2，3种写法，则会循环调用on方法。并返回false使on方法return。
  // eventsApi方法返回true则说明是第一种参数写法，继续判断callback，若callback未传值，则直接return。
  if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this; 
  this._events || (this._events = {});
  var events = this._events[name] || (this._events[name] = []);
  // 把事件监听器放到一个专门放置事件监听器的对象_events中，供需要的时候调用
  events.push({callback: callback, context: context, ctx: context || this}); // context 和 ctx ？？
  return this;
},
```
### Events.off
#### Usage
```javascript
1. obj.off() 
2. obj.off('eventName'[, callback][, context])
3. obj.off('eventName1 eventName2'[, callback][, context])
4. obj.off({
  'eventName1': callback1,
  'eventName2': callback2
}[, context])
```

#### Explain
Remove one or many callbacks. If `context` is null, removes all callbacks with that function. If `callback` is null, removes all callbacks for the event. If `name` is null, removes all bound callbacks for all events.
```
off: function(name, callback, context) {
  var retain, ev, events, names, i, l, j, k;
  // 如果_events未定义，则说明还没有事件监听器被注册，直接返回
  // 通过私有函数eventsApi对不同形式的参数进行处理
  if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
  if (!name && !callback && !context) { // 如果没有传入任何参数，则直接删除_events对象，即删除所有已注册的事件监听器
    this._events = void 0;
    return this;
  }
  // _.keys(this._events)用来取出_events对象里面的所有属性名称，ES5里面有个Object.keys方法作用一样
  names = name ? [name] : _.keys(this._events);
  for (i = 0, l = names.length; i < l; i++) {
    name = names[i];
    if (events = this._events[name]) {
      this._events[name] = retain = [];  // 先清空数组
      if (callback || context) { // 看是否提供了callback或context参数
        for (j = 0, k = events.length; j < k; j++) {
          ev = events[j];
          if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
              (context && context !== ev.context)) {
            retain.push(ev);
          }
        }
      }
      if (!retain.length) delete this._events[name];
    }
  }

  return this;
},
```
### Events.once
#### Usage
用法同Events.on, 不同之处就是这个事件只能被触发一次

#### Explain
```javascript
once: function(name, callback, context) {
  // 同样先调用私有函数enentsApi处理参数
  if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
  var self = this;
  var once = _.once(function() { // 使用underscore提供的once方法创建一个只能执行一次的函数（这里为何使用once创建一个只能执行的函数，而不是直接定义一个函数像jQuery那样？）
    self.off(name, once); // 在函数调用的时候，移除事件监听
    callback.apply(this, arguments);  // 调用callback
  });
  once._callback = callback; // 保存原来的callback，在Events.off的时候会用到
  return this.on(name, once, context); // 将处理好的callback传入Events.on进行事件绑定
},
```

### Events.trigger
#### Usage
```
object.trigger(eventName, [*args]) // args会作为参数传递给callback，如果eventName为all，也会传递给callback
```

#### Explain
```
trigger: function(name) {
  if (!this._events) return this;
  var args = slice.call(arguments, 1);
  if (!eventsApi(this, 'trigger', name, args)) return this; // 同样调用私有函数eventsApi处理参数
  var events = this._events[name];
  var allEvents = this._events.all; // Callbacks bound to the special "all" event will be triggered when any event occurs, 
  if (events) triggerEvents(events, args); // 调用私有函数triggerEvents来调用事件监听函数
  if (allEvents) triggerEvents(allEvents, arguments);
  return this;
},
```

### eventsApi (内部私有函数)
```
// Implement fancy features of the Events API such as multiple event
// names `"change blur"` and jQuery-style event maps `{change: action}`
// in terms of the existing API.
// 针对Events API多种不同的使用方式进行判断、处理。可能有如下写法
// 1. 'change'
// 2. 'change blur'
// 3. {change: callback1, blur: callback2}
// 如果事件名为空，或者为第1种写法，则返回true，否则返回false
var eventsApi = function(obj, action, name, rest) {
  if (!name) return true; // 如果name 参数为空

  // Handle event maps. 如果是第3种写法
  if (typeof name === 'object') {
    for (var key in name) {
      obj[action].apply(obj, [key, name[key]].concat(rest));
    }
    return false;
  }

  // Handle space separated event names.
  // 如果是第2种写法
  if (eventSplitter.test(name)) {
    var names = name.split(eventSplitter);
    for (var i = 0, l = names.length; i < l; i++) {
      obj[action].apply(obj, [names[i]].concat(rest));
    }
    return false;
  }

  return true;
};
```

### triggerEvents (内部私有函数)  [reference](http://www.cnblogs.com/snandy/archive/2013/05/23/3091258.html)
```
// A difficult-to-believe, but optimized internal dispatch function for
// triggering events. Tries to keep the usual cases speedy (most internal
// Backbone events have 3 arguments).
var triggerEvents = function(events, args) {
  var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
  // 虽然难以相信，但却是为了性能考虑。多数Backbone内部方法触发事件时会传3个参数，即会使用call（而非apply）。
  // 按此推理，call的性能较apply要高。搜关键字 "call apply performance"， 貌似印证了这个说法 
  switch (args.length) { // 冗余换性能。
    case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
    case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
    case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
    case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
    default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
  }
};
```

### Events.ListenTo & Events.listenToOnce
#### Usage
ListenTo对应on, listenToOnce对应once.第二个参数的写法同Events.on
```
obj1.ListenTo(obj2, eventName, callback)
```
使用场景举例：view和model之间的通信
view.listenTo(model, change, callback)，当model发生变化触发change事件时，view.callback会被调用，实现了model的变化，联动view

#### Explain
```
// Inversion-of-control versions of `on` and `once`. Tell *this* object to
// listen to an event in another object ... keeping track of what it's
// listening to.
_.each(listenMethods, function(implementation, method) {
  Events[method] = function(obj, name, callback) {
    // listeningTo & this._listeningTo用来放置目标Object，通过一个全局唯一的id索引
    var listeningTo = this._listeningTo || (this._listeningTo = {});
    var id = obj._listenId || (obj._listenId = _.uniqueId('l')); // 为obj生成一个全局唯一的id
    listeningTo[id] = obj;
    if (!callback && typeof name === 'object') callback = this; // 参数处理
    obj[implementation](name, callback, this); // 注册事件监听器
    return this;
  };
});
```

### Events.stopListening
#### Usage
这个方法比较简单，在使用listenTo和listenToOnce的时候会把被listen的object存放到this._listeningTo对象中，当调用stopListening方法就会从_listeningTo对象中取出响应的对象，进行事件监听器的off处理，必要的时候从_listeningTo对象中移除该object。

#### Explain
```
// Tell this object to stop listening to either specific events ... or
// to every object it's currently listening to.
stopListening: function(obj, name, callback) {
  var listeningTo = this._listeningTo;
  if (!listeningTo) return this;
  var remove = !name && !callback; // 如果只有一个参数，则remove = true
  if (!callback && typeof name === 'object') callback = this; // 不同形式参数处理
  if (obj) (listeningTo = {})[obj._listenId] = obj; // 如果提供了obj参数，对obj进行处理；否则，移除所有
  for (var id in listeningTo) {
    obj = listeningTo[id];
    obj.off(name, callback, this);
    if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
  }
  return this;
}
```

## Backbone.Model
**Models** are the heart of any JavaScript application, containing the interactive data as well as a large part of the logic surrounding it: conversions, validations, computed properties, and access control. You extend **Backbone.Model** with your domain-specific methods, and **Model** provides a basic set of functionality for managing changes.

