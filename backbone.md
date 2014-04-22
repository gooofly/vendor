## Backbone.Events

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

### Explain
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

#### eventsApi (内部私有函数)
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

#### triggerEvents (内部私有函数)
```
// A difficult-to-believe, but optimized internal dispatch function for
// triggering events. Tries to keep the usual cases speedy (most internal
// Backbone events have 3 arguments).
var triggerEvents = function(events, args) {
  var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
  // 虽然难以相信，但却是为了性能考虑。多数Backbone内部方法触发事件时会传3个参数，即会使用call（而非apply）。
  // 按此推理，call的性能较apply要高。搜关键字 "call apply performance"， 貌似印证了这个说法 http://www.cnblogs.com/snandy/archive/2013/05/23/3091258.html
  switch (args.length) { // 冗余换性能。
    case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
    case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
    case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
    case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
    default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
  }
};
```