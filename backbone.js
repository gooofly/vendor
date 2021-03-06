//     Backbone.js 1.1.2

//     (c) 2010-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(root, factory) {

  // Set up Backbone appropriately for the environment. Start with AMD.
  // 根据环境适当的配置Backbone
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      // 输出全局变量即使在AMD环境中，
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  // 在nodejs环境中，jQuery就不需要了
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore');
    factory(root, exports, _);

  // Finally, as a browser global.
  // 浏览器环境中，及通过script标签手动引入的情况下
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(this, function(root, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  // 保存原来的Backbone的值, 可供`noConflict`使用
  var previousBackbone = root.Backbone;

  // Create local references to array methods we'll want to use later.
  // 创建对原生数组方法的本地引用, 以方便后面调用.
  var array = [];
  var push = array.push;
  var slice = array.slice;
  var splice = array.splice;

  // Current version of the library. Keep in sync with `package.json`.
  // 代码库的当前版本, 需要和`package.json`保持同步.
  Backbone.VERSION = '1.1.2';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  // 放弃以"Backbone"命名框架, 并返回Backbone对象, 一般用于避免命名冲突或规范命名方式
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  // 对于不支持REST方式的浏览器, 可以设置Backbone.emulateHTTP = true
  // 设置这个配置项会通过'_method'参数模拟 'PATCH', 'PUT', 'DELETE'请求，
  // 同时也将发送'X-Http-Method-Override'头信息.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  // 对于不支持application/json编码的浏览器, 可以设置Backbone.emulateJSON = true;
  // 将请求类型设置为application/x-www-form-urlencoded, 并将数据放置在model参数中实现兼容
  Backbone.emulateJSON = false;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  // 这个模块可以被其它任何对象继承，使他们支持自定义事件。你可以通过on来
  // 绑定事件，通过off来解除绑定, 当事件完成时通过trigger方法来触发事件。
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    // 把一个回调函数绑定到事件上。事件名传入'all'会把回调函数绑定到所有事件上去.
    // 
    // note: 实际上绑定事件的方式就是创建一个以事件名为key的hash，如下结构：
    // _events: {
    //    change: [
    //      {
    //        callback: callback,
    //        context: context,
    //        ctx: contenxt || this
    //      },
    //      ...
    //    ],
    //    blur: [...]
    // }
    // Usage：
    // 1. obj.on('eventName', callback[, context]);
    // 2. obj.on('eventName1 eventName2', callback[, context]);
    // 3. obj.on({
    //   'eventName1': callback1,
    //   'eventName2': callback2
    // }[, context]);
    on: function(name, callback, context) {
      // 如果name是'change blur'或{change: callback}这种写法，会在eventsApi里面循环调用on方法
      // eventsApi方法返回true则说明是第一种参数写法，继续判断callback，若callback未传值，则直接return。
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this; 
      // this._events若不存在则初始化. --- this._events对象用于存放已注册的事件和回调函数
      this._events || (this._events = {});
      // this._events = this._events || {}; 相比较而言,这种写法更加的耗时
      var events = this._events[name] || (this._events[name] = []);
      // 把事件监听器放到一个专门放置事件监听器的对象_events中，供需要的时候调用
      // context用于解绑事件时对context进行对比, ctx用于触发时绑定作用域上下文
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind events to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    // 绑定一个只会被触发一次的事件监听器, 在callback被调用后,将会移除事件
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = function() { // https://github.com/jashkenas/backbone/issues/3200
        self.off(name, once); // 在callback执行前，移除事件监听
        callback.apply(this, arguments); // 执行callback
      };
      // 保存原来的callback，在Events.off的时候用来匹配callback
      once._callback = callback; 
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. 
    // If `context` is null, removes all callbacks with that function. 
    // If `callback` is null, removes all callbacks for the event. 
    // If `name` is null, removes all bound callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      // 如果_events未定义，则说明还没有事件监听器被注册，直接返回
      // 通过私有函数eventsApi对不同形式的参数进行处理
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) { // 如果没有传入任何参数，则直接删除_events对象，即删除所有已注册的事件监听器
        this._events = void 0;
        return this;
      }
      // _.keys(this._events)用来取出_events对象里面的所有事件名称，ES5里面有个Object.keys方法作用一样
      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if ( events = this._events[name] ) {
          this._events[name] = retain = [];  // 先清空数组
          if (callback || context) { // 看是否提供了callback或context参数, 没有提供则直接移除所有eventName事件
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              // !callback || callback === ev.callbck || callback === ev.callbck._callback
              // !context || context === ev.context
              // 1. 当callback未传入, 或者虽然已传入callback但callback和绑定时的callback不能对应
              // 2. 当context未传入, 或者虽然已传入context但context和绑定时的context不能对应
              // 1 2 中的任意一种情况满足都表示这个事件不该被移除
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev); // 排除不匹配的callback，重新push回数组中
              }
            }
          }
          // 如果事件对应的callback都被移除了,则移除对这个事件的绑定.
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    // 触发一个, 多个, 所有绑定事件. callback能获得所有传递给trigger的参数(除了事件名).
    // 如果我们注册了'all'事件，那么在触发任何事件的时候，'all'都会被触发, 
    // 并且被触发事件的事件名也会作为参数传递给callback
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      // 根据传入参数的不同形式做
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      // Callbacks bound to the special "all" event will be triggered when any event occurs, 
      // 任何事件触发都会触发`all`事件
      var allEvents = this._events.all; 
      if (events) triggerEvents(events, args); // 调用私有函数triggerEvents来调用事件监听函数
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    // 
    // 告诉obj对象停止对指定事件的监听,
    // 
    // 这个方法比较简单，在使用listenTo和listenToOnce的时候会把被listen的object存放到this._listeningTo对象中，
    // 当调用stopListening方法就会从_listeningTo对象中取出相应的对象，
    // 进行事件监听器的off处理，必要的时候从_listeningTo对象中移除该object。
    stopListening: function(obj, name, callback) {
      var listeningTo = this._listeningTo;
      // 如果this._listeningTo不存在, 说明没有对象被监听, 直接返回
      if (!listeningTo) return this;
      // 如果只有一个参数，则remove = true
      var remove = !name && !callback; 
      if (!callback && typeof name === 'object') callback = this; // 不同形式参数处理
      // 如果提供了obj参数，对listeningTo进行处理, 使它能兼容for in循环的写法；否则，移除所有
      if (obj) (listeningTo = {})[obj._listenId] = obj;
      for (var id in listeningTo) {
        obj = listeningTo[id];
        obj.off(name, callback, this); // 解除对象上的事件绑定
        // 如果没有传入事件名和callback, 或者对象上已经没有被绑定的事件, 那么解除对对象的监听,
        // 并从this._listeningTo中移除
        if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  // 正则表达式, 用来分割这种('eventName1 eventName2')写法的事件名
  var eventSplitter = /\s+/;

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

    // Handle event maps. 
    // 如果是第3种写法
    if (typeof name === 'object') {
      for (var key in name) {
        // 遍历对象, 分别绑定每一个事件
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    // 如果是第2种('eventName1 eventName2')写法
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    // 虽然难以相信，但却是为了性能考虑。多数Backbone内部方法触发事件时会传3个参数，即会使用call（而非apply）。
    // 按此推理，call的性能较apply要高。搜关键字 "call apply performance"， 
    // 貌似印证了这个说法 http://www.cnblogs.com/snandy/archive/2013/05/23/3091258.html
    switch (args.length) { // 冗余换性能。
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  // ObjectA.listenTo(ObjectB, name, callback);
  // 这样写的效果为ObjectB.on(name, callback, ObjectA)，
  // 相当于把事件监听器绑定到ObjectB上，context为ObjectA，比如数据视图的双向绑定
  // view.listenTo(model, change, function() {...})
  // 当model发生改变时，触发change事件，而callback是绑定在view上的，即能对view进行改变
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      // 取出/创建`this._listeningTo`(这个对象用来存放Obj)
      var listeningTo = this._listeningTo || (this._listeningTo = {});
      var id = obj._listenId || (obj._listenId = _.uniqueId('l')); // 为obj生成一个全局唯一的id
      listeningTo[id] = obj; // 对象以唯一标识符作为key, 保存在this._listeningTo中
      if (!callback && typeof name === 'object') callback = this; // 参数处理
      obj[implementation](name, callback, this); // 注册事件监听器
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

    // Backbone **Models** are the basic data object in the framework --
    // frequently representing a row in a table in a database on your server.
    // A discrete chunk of data and a bunch of useful, related methods for
    // performing computations and transformations on that data.
    // 
    // Model是Backbone中所有数据对象模型的基类, 一般情况下, 它对应于服务器端数据库表中的"行".
    // Model用于存放数据和一些用于对数据进行计算, 转化等其它处理的方法

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  // 用来实例化一个Model, 可以传入指定属性.
  // 自动生成一个唯一标识符(前缀 "c" ), 并分配给实例对象
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId('c'); // automatically generated and assigned a client id
    // Backbone 中, 实例化后的模型对象所有属性都保存在一个名为 attribues 的对象中,
    // 对象的 set 或 get 方法都是围绕该对象进行存取的
    this.attributes = {};
    if (options.collection) this.collection = options.collection; // TODO:?
    // If `{parse: true}` is passed as an option, 
    // the attributes will first be converted by parse before being set on the model.
    // 如果创建Model时配置项设置了 `{parse: true}`, 那么会通过 `parse` 方法处理属性
    if (options.parse) attrs = this.parse(attrs, options) || {}; 
    // this.defaults属性/方法用来设置默认值, 下面这个月语句的作用是, 用默认值来填充属性, 如果该属性未设置
    attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
    // 
    this.set(attrs, options);
    // 用来保存被改变的属性
    this.changed = {};
    // Initialization 调用 `this.initialize`,进行初始化, 一般在继承Model类的时候, 我们需要覆写这个方法
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  // 为Model原型对象添加方法、属性, Model继承Events对象.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    // 用来保存被改变的属性
    changed: null,

    // The value returned during the last failed validation.
    // validation验证错误时的提示信息
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    // 默认的Initialize是一个空函数, 在继承Model是可以把初始化逻辑写到这个函数里
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    // 返回model的'attributes'对象
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    // 默认调用'Backbone.sync' -- 可覆写
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    // 取值
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    // 返回转义HTML字符后的属性
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null or undefined.
    // 如果**Model**中有该属性，返回true
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    // 给**model**设置属性，并且会触发'"change"'事件。这个是model的核心操作方法，更新数据，并通知
    // 给需要的人知道改变的状态。The heart of the beast。
    set: function(key, val, options) {
      var attr, attrs, unset, changes, silent, changing, prev, current;
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      // set的参数支持不同的写法
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      // 调用validation函数
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      // 提取属性
      unset           = options.unset; // unset 表示是否是删除属性
      silent          = options.silent; // 是否为静默模式, 静默模式不触发任何事件
      changes         = [];
      changing        = this._changing; // 是否正在设置属性
      this._changing  = true;

      if (!changing) { // 为了防止嵌套设置属性的时候重复设值导致出问题
        this._previousAttributes = _.clone(this.attributes); // 复制出改变前的数据
        this.changed = {};
      }
      current = this.attributes, prev = this._previousAttributes;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      for (attr in attrs) {
        val = attrs[attr];
        // 如果新值和旧值不同, 则将该值得 key 存入 `changes` 数组, 该数组用于触发 `change:key` 事件
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        // 如果新值
        if (!_.isEqual(prev[attr], val)) {
          this.changed[attr] = val;
        } else {
          delete this.changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val; // 如果配置了unset则删除属性，否则设置属性
      }

      // Trigger all relevant attribute changes.
      // 如果没有设置静默模式则触发所有相关属性的'"change"',如果设置silent为true，表示静默模式修改数据，即在修改时不触发任何事件
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0, l = changes.length; i < l; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        // 为了防止嵌套设属性的时候重复trigger，参照这个[test](https://github.com/jashkenas/backbone/pull/2022)
        while (this._pending) { 
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    // 从**model**中移除属性，会触发'"change"'，如果属性不存在`unset`不会做任何操作
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    // 清空model中的属性，会触发'"change"'
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0; // 循环this.attributes，复制所有key，并都赋值undefined
      return this.set(attrs, _.extend({}, options, {unset: true})); // 调用this.set，应用空数据
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    // 检查**model**从最后一次'"change"'事件后，属性是否有改变。如果你指定了一个属性名，
    // 那么就检查这个属性是否有改变。
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed); // 如果this.changed为空，则说明没有变化
      return _.has(this.changed, attr); // 如果this.changed里面不包含这个属性，则说明没有变化
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    // 返回一个包含所有发生改变的属性的对象，如果没有属性改变，则返回false。
    // 在决定哪部分的view需要升级add/or什么属性需要持久化到服务器时很有用。移除属性会使
    // 属性变为undefined。你也可以传递一个包含属性的对象去和model的属性对比，决定是否有不同。
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false; // 如果没有传参，则说明是要返回所有发生改变的属性
      var val, changed = false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      for (var attr in diff) { // 遍历参数中的属性
        if (_.isEqual(old[attr], (val = diff[attr]))) continue; // 如果相等就进行下一个判断
        (changed || (changed = {}))[attr] = val; // 存储有变化的属性
      }
      return changed;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    // 返回最后一次'"change"'事件触发前属性的值
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    // 返回最后一次'"change"'事件触发前的所有属性
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server. If the server's representation of the
    // model differs from its current attributes, they will be overridden,
    // triggering a `"change"` event.
    // 从服务端取数据。如果服务端的数据和当前的不同，则会覆盖当前属性，并触发'"change"'
    fetch: function(options) {
      options = options ? _.clone(options) : {}; // 这里为何需要clone
      if (options.parse === void 0) options.parse = true; // If `{parse: true}` is passed as an option, the attributes will first be converted by parse before being set on the model.
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        if (!model.set(model.parse(resp, options), options)) return false; // set attributes
        if (success) success(model, resp, options); // invoke success
        model.trigger('sync', model, resp, options); // trigger sync
      };
      wrapError(this, options); // 设置options.error方法
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    // 为model设置属性，并且将model同步到服务端。如果服务端返回的数据和model不同，
    // model会重新设置属性
    save: function(key, val, options) {
      var attrs, method, xhr, attributes = this.attributes;

      // Handle both `"key", value` and `{key: value}` -style arguments. 参数处理成对象的形式
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true}, options);  // 设置validate

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !options.wait) {  // 如果options.wait = false并且attrs不为空，设置属性。
        if (!this.set(attrs, options)) return false;
      } else { // 校验属性
        if (!this._validate(attrs, options)) return false;
      }

      // Set temporary attributes if `{wait: true}`.
      // 如果'{wait: true}'，设置临时属性
      if (attrs && options.wait) {
        this.attributes = _.extend({}, attributes, attrs);
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      // 当服务端成功保存后，客户端更新状态
      if (options.parse === void 0) options.parse = true; // If `{parse: true}` is passed as an option, the attributes will first be converted by parse before being set on the model.
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = model.parse(resp, options);
        if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
        if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) { // 如果设置不成功，则return false
          return false;
        }
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch') options.attrs = attrs;
      xhr = this.sync(method, this, options);

      // Restore attributes.
      if (attrs && options.wait) this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    // 如果model在服务器已经被持久化了，删除它。并从collection删除它，如果它在一个collection中。
    // 如果设置了`wait: true`，在删除前等待服务器的response
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;

      var destroy = function() {
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (options.wait || model.isNew()) destroy();
        if (success) success(model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      if (this.isNew()) {
        options.success();
        return false;
      }
      wrapError(this, options);

      var xhr = this.sync('delete', this, options);
      if (!options.wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    // model指向服务器的默认url -- 如果你用的是Backbone的restful方法，覆盖这个函数
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(this.id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    // **parse**将响应数据转化成set能接受的hash格式。默认的实现仅仅简单的返回response
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    // 拷贝一个数据一样的model
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    // **model**是否'新'的如果它从来没有向服务器保存数据，没有idAttribute
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.extend(options || {}, { validate: true }));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }
  });

  // Underscore methods that we want to implement on the Model.
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  _.each(modelMethods, function(method) {
    Model.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.attributes);
      return _[method].apply(_, args);
    };
  });

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analogous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`. 508090

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    // 配置是否对 `Model` 进行排序
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset(); // 重置内部变量
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model){ return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      var singular = !_.isArray(models);
      models = singular ? [models] : _.clone(models);
      options || (options = {});
      var i, l, index, model;
      for (i = 0, l = models.length; i < l; i++) {
        model = models[i] = this.get(models[i]);
        if (!model) continue;
        delete this._byId[model.id];
        delete this._byId[model.cid];
        index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;
        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }
        this._removeReference(model, options);
      }
      return singular ? models[0] : models;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      options = _.defaults({}, options, setOptions);
      if (options.parse) models = this.parse(models, options);
      var singular = !_.isArray(models);
      models = singular ? (models ? [models] : []) : _.clone(models);
      var i, l, id, model, attrs, existing, sort;
      var at = options.at;
      var targetModel = this.model;
      var sortable = this.comparator && (at == null) && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;
      var toAdd = [], toRemove = [], modelMap = {};
      var add = options.add, merge = options.merge, remove = options.remove;
      var order = !sortable && add && remove ? [] : false;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      for (i = 0, l = models.length; i < l; i++) {
        attrs = models[i] || {};
        if (attrs instanceof Model) {
          id = model = attrs;
        } else {
          id = attrs[targetModel.prototype.idAttribute || 'id'];
        }

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        if (existing = this.get(id)) {
          if (remove) modelMap[existing.cid] = true;
          if (merge) {
            attrs = attrs === model ? model.attributes : attrs;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(attrs, options);
          if (!model) continue;
          toAdd.push(model);
          this._addReference(model, options);
        }

        // Do not add multiple models with the same `id`.
        model = existing || model;
        if (order && (model.isNew() || !modelMap[model.id])) order.push(model);
        modelMap[model.id] = true;
      }

      // Remove nonexistent models if appropriate.
      if (remove) {
        for (i = 0, l = this.length; i < l; ++i) {
          if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
        }
        if (toRemove.length) this.remove(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      if (toAdd.length || (order && order.length)) {
        if (sortable) sort = true;
        this.length += toAdd.length;
        if (at != null) {
          for (i = 0, l = toAdd.length; i < l; i++) {
            this.models.splice(at + i, 0, toAdd[i]);
          }
        } else {
          if (order) this.models.length = 0;
          var orderedModels = order || toAdd;
          for (i = 0, l = orderedModels.length; i < l; i++) {
            this.models.push(orderedModels[i]);
          }
        }
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort events.
      if (!options.silent) {
        for (i = 0, l = toAdd.length; i < l; i++) {
          (model = toAdd[i]).trigger('add', model, this, options);
        }
        if (sort || (order && order.length)) this.trigger('sort', this, options);
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options || (options = {});
      for (var i = 0, l = this.models.length; i < l; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      this.remove(model, options);
      return model;
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      this.remove(model, options);
      return model;
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id.
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj] || this._byId[obj.id] || this._byId[obj.cid];
    },

    // Get the model at the given index.
    at: function(index) {
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      if (_.isEmpty(attrs)) return first ? void 0 : [];
      return this[first ? 'find' : 'filter'](function(model) {
        for (var key in attrs) {
          if (attrs[key] !== model.get(key)) return false;
        }
        return true;
      });
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      // Run sort based on type of `comparator`.
      if (_.isString(this.comparator) || this.comparator.length === 1) {
        this.models = this.sortBy(this.comparator, this);
      } else {
        this.models.sort(_.bind(this.comparator, this));
      }

      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return _.invoke(this.models, 'get', attr);
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success(collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      if (!(model = this._prepareModel(model, options))) return false;
      if (!options.wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(model, resp) {
        if (options.wait) collection.add(model, options);
        if (success) success(model, resp, options);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models);
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    // 私有方法，用来重置内部状态。在collection第一次初始化或reset的时候调用。
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (attrs instanceof Model) return attrs;
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      if (model.id != null) this._byId[model.id] = model;
      if (!model.collection) model.collection = this;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model, options) {
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (model && event === 'change:' + model.idAttribute) {
        delete this._byId[model.previous(model.idAttribute)];
        if (model.id != null) this._byId[model.id] = model;
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
    'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
    'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
    'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
    'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
    'lastIndexOf', 'isEmpty', 'chain', 'sample'];

  // Mix in each Underscore method as a proxy to `Collection#models`.
  _.each(methods, function(method) {
    Collection.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.models);
      return _[method].apply(_, args);
    };
  });

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

  // Use attributes instead of properties.
  _.each(attributeMethods, function(method) {
    Collection.prototype[method] = function(value, context) {
      var iterator = _.isFunction(value) ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    options || (options = {});
    // 过滤 options 对象中的属性, 只有 viewOptions 中列出的属性才有效
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
    this.delegateEvents();
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this.$el.remove();
      this.stopListening();
      return this;
    },

    // Change the view's element (`this.el` property), including event
    // re-delegation.
    setElement: function(element, delegate) {
      if (this.$el) this.undelegateEvents();
      this.$el = element instanceof Backbone.$ ? element : Backbone.$(element);
      this.el = this.$el[0];
      if (delegate !== false) this.delegateEvents();
      return this;
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    // This only works for delegate-able events: not `focus`, `blur`, and
    // not `change`, `submit`, and `reset` in Internet Explorer.
    delegateEvents: function(events) {
      // 如果没有传入 events 参数, 并且实例对象没有 events属性, 则直接返回
      if (!(events || (events = _.result(this, 'events')))) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        // TODO: if (!_.isFunction(method)) method = this[method];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) continue; // 如果没传入函数, 跳过

        var match = key.match(delegateEventSplitter);
        var eventName = match[1], selector = match[2];
        method = _.bind(method, this);
        eventName += '.delegateEvents' + this.cid;
        if (selector === '') {
          this.$el.on(eventName, method);
        } else {
          this.$el.on(eventName, selector, method);
        }
      }
      return this;
    },

    // Clears all callbacks previously bound to the view with `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    // 清除所有通过 `delegateEvents` 命名空间绑定在 view 上的事件. 通常你并不需要用到这个方法,
    // 除非, 你在同一个 DOM 上绑定了多个 Backbone View.
    undelegateEvents: function() {
      this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    // 
    // 确保有一个 DOM 元素能作为容器渲染 View.
    // 
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        // 因为 `class` 是保留字, 所以不能直接用 `.` 操作符去取值
        if (this.className) attrs['class'] = _.result(this, 'className');
        var $el = Backbone.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
        this.setElement($el, false);
      } else {
        // TODO: 我觉得这里不再需要写 `_.result(this, 'el')` 了, 因为 this 上面没有 el 属性啊,,,
        this.setElement(_.result(this, 'el'), false);
      }
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    // 根据CRUD方法名定义与服务器交互的方法(POST, GET, PUT, DELETE)
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    // params将作为请求参数对象传递给第三方库的$.ajax方法
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    // 如果在发送请求时没有在options中设置url地址, 将会通过 model 对象的url属性或方法来获取url
    // model 所获取url的方式可参考 model 的url方法
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    // 如果调用 create, update 和 patch 方法, 且没有在options中定义请求数据, 
    // 将序列化模型中的数据对象传递给服务器
    if (options.data == null && model && 
        (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      // 序列化模型中的数据, 并作为请求数据传递给服务器
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    // 对于不支持application/json编码的浏览器, 可以通过设置Backbone.emulateJSON参数为true实现兼容
    if (options.emulateJSON) {
      // 不支持Backbone.emulateJSON编码的浏览器, 将类型设置为application/x-www-form-urlencoded
      params.contentType = 'application/x-www-form-urlencoded';
      // 将需要同步的数据存放在key为"model"参数中发送到服务器
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    // 对于不支持REST方式的浏览器, 可以设置Backbone.emulateHTTP参数为true, 
    // 以POST方式发送数据, 并在数据中加入_method参数标识操作名称
    // 同时也将发送X-HTTP-Method-Override头信息
    if (options.emulateHTTP && 
        (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {

      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    // 对非GET方式的请求, 将不对数据进行转换, 因为传递的数据可能是一个JSON映射
    if (params.type !== 'GET' && !options.emulateJSON) {
      // 通过设置processData为false来关闭数据转换
      // processData参数是$.ajax方法中的配置参数, 详细信息可参考jQuery或Zepto相关文档
      params.processData = false;
    }

    // If we're sending a `PATCH` request, and we're in an old Internet Explorer
    // that still has ActiveX enabled by default, override jQuery to use that
    // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
    if (params.type === 'PATCH' && noXhrPatch) {
      params.xhr = function() {
        return new ActiveXObject("Microsoft.XMLHTTP");
      };
    }

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  var noXhrPatch =
    typeof window !== 'undefined' && !!window.ActiveXObject &&
      !(window.XMLHttpRequest && (new XMLHttpRequest).dispatchEvent);

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    // options.routes 可以是一个 {}, 也可以是一个返回{}的function
    if (options.routes) this.routes = options.routes;
    this._bindRoutes(); // 绑定通过配置项  `routes` 配置的路由
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  // 
  // var str = '*hello (?:dog) hello(gooofly) :cat'
  var optionalParam = /\((.*?)\)/g; // 匹配 `(?:dog)` adn `(gooofly)`
  var namedParam    = /(\(\?)?:\w+/g; // 匹配 `(?:dog` and `:cat`
  var splatParam    = /\*\w+/g; // 匹配 `*hello`
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g; // 匹配 `-{}[]+?.,\^$|# ` 之一

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    // 动态修改url中hash属性的匹配规则和动作函数
    route: function(route, name, callback) {
      // 把非正则的路由转换成正则
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) { // 如果 name 是 function, 交换参数
        callback = name;
        name = '';
      }
      // 如果没有传 callback 则,说明 callback 在实例对象上, 通过 name 去取
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment); // 从url中抽取参数
        router.execute(callback, args); // 执行路由对应的 action
        // 触发相对应的 route 事件(如果有绑定)
        router.trigger.apply(router, ['route:' + name].concat(args));
        // 触发 route 事件
        router.trigger('route', name, args);

        Backbone.history.trigger('route', router, name, args);
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    // 调用路由对应的函数 (controller)
    execute: function(callback, args) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    // 自动跳转到指定的hash属性中,并通过方法中的配置对象设置是否执行与hash匹配
    // 规则对应的动作函数.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    // 把所有路由存储到 `Backbone.history`
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes'); // 提取 new 时配置的routes属性
      var route, routes = _.keys(this.routes); // 提取所有路由
      while ((route = routes.pop()) != null) { // 遍历, 绑定路由
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    // 把字符串形式的 route 转化成正则表达式.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&') // 替换 `-{}[]+?.,\^$|# ` 中的字符为 `\\$&`
                   .replace(optionalParam, '(?:$1)?') // 替换括号
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    // 根据路由, 从url中抽取参数, 空或未匹配到的设置为null
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  // 创建跨浏览器的 history.
  var History = Backbone.History = function() {
    this.handlers = [];
    _.bindAll(this, 'checkUrl');

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  // 正则表达式,用于匹配以 `#` 或 `/` 开头, 或以空字符结尾的字符串
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  // 正则表达式,用于匹配以一个或多个`/`开头或结尾的字符串
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for detecting MSIE.
  // 正则表达式,用于检测是否是 IE
  var isExplorer = /msie [\w.]+/;

  // Cached regex for removing a trailing slash.
  // 正则表达式, 匹配字符串尾部的 `/`
  var trailingSlash = /\/$/;

  // Cached regex for stripping urls of hash.
  // 正则表达式, 匹配以#开头的字符串, 用于分离 URL 中的 hash 部分
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  // 状态符, 用来标识是否开始监控url变化
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  // 设置所有可继承的属性和方法(即:原型属性和方法)
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    // 轮询事件间隙
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      return this.location.pathname.replace(/[^\/]$/, '$&/') === this.root;
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    // 获取 hash 的值(不包含`#`), 不能直接使用 `location.hash` 是因为 Firefox 总是会
    // 返回编码后的值
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the cross-browser normalized URL fragment, either from the URL,
    // the hash, or the override.
    getFragment: function(fragment, forcePushState) {
      if (fragment == null) {
        if (this._hasPushState || !this._wantsHashChange || forcePushState) {
          fragment = decodeURI(this.location.pathname + this.location.search);
          var root = this.root.replace(trailingSlash, '');
          if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error("Backbone.history has already been started");
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      // 计算初始化配置
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root; // 根路由
      this._wantsHashChange = this.options.hashChange !== false;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
      var fragment          = this.getFragment();
      var docMode           = document.documentMode;
      var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

      // Normalize root to always include a leading and trailing slash.
      // 标准化根路由,使它头尾总有,且只有一个`/`
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      if (oldIE && this._wantsHashChange) {
        var frame = Backbone.$('<iframe src="javascript:0" tabindex="-1">');
        this.iframe = frame.hide().appendTo('body')[0].contentWindow;
        this.navigate(fragment);
      }

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._hasPushState) {
        Backbone.$(window).on('popstate', this.checkUrl);
      } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
        Backbone.$(window).on('hashchange', this.checkUrl);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      // Determine if we need to change the base url, for a pushState link
      // opened by a non-pushState browser.
      this.fragment = fragment;
      var loc = this.location;

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          this.fragment = this.getFragment(null, true);
          this.location.replace(this.root + '#' + this.fragment);
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot() && loc.hash) {
          this.fragment = this.getHash().replace(routeStripper, '');
          this.history.replaceState({}, document.title, this.root + this.fragment);
        }

      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      Backbone.$(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    // 检查当前url是否发生变化, 如果由,调用 `loadUrl`.
    checkUrl: function(e) {
      var current = this.getFragment();
      if (current === this.fragment && this.iframe) {
        current = this.getFragment(this.getHash(this.iframe));
      }
      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    // 尝试加载当前 url 片段, 如果能匹配到配置的路由,执行对应 callback,
    // 并返回true; 否则, 返回true
    loadUrl: function(fragment) {
      fragment = this.fragment = this.getFragment(fragment);
      return _.any(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    // 保存 url片段(路由)到 history, 或者替换 URL 状态, 如果传入了`replace`参数
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      // 如果History没有被标记为 "开始", 直接返回false
      if (!History.started) return false;
      // 如果options没有传值,或者传值为false,或者值为true, 则
      if (!options || options === true) options = {trigger: !!options};

      // 拼页面的url
      var url = this.root + (fragment = this.getFragment(fragment || ''));

      // Strip the hash for matching.
      // 删除url中的hash部分
      fragment = fragment.replace(pathStripper, '');

      // 如果 hash 没有变化,直接返回
      if (this.fragment === fragment) return;
      this.fragment = fragment; // 设置 hash 为最新的 hash

      // Don't include a trailing slash on the root.
      // 删除末尾的'/'
      if (fragment === '' && url !== '/') url = url.slice(0, -1);

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._hasPushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if(!options.replace) this.iframe.document.open().close();
          this._updateHash(this.iframe.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    // 是否为子类定义了constructor构造器函数，如果没有则调用父类构造器
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    // 继承父类的静态方法
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    // 继承父类的原型对象
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    // 扩展子类原型对象
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    // 设置一个指向父类原型对象的属性
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  // 为一个可选的error回调函数包装一个error事件
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error(model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;

}));
