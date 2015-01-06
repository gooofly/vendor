//     Underscore.js 1.7.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.


// underscore这个库的结构（或者说思路）大致是这样的：
// 创建一个包装器, 将一些原始数据进行包装，所有的undersocre对象, 内部均通过wrapper函数进行构造和封装
// underscore与wrapper的内部关系是:
// - 内部定义变量_, 将underscore相关的方法添加到_, 这样就可以支持函数式的调用, 如_.bind()
// - 内部定义wrapper类, 将_的原型对象指向wrapper类的原型
// - 将underscore相关的方法添加到wrapper原型, 创建的_对象就具备了underscore的方法
// - 将Array.prototype相关方法添加到wrapper原型, 创建的_对象就具备了Array.prototype中的方法
// - new _()时实际创建并返回了一个wrapper()对象, 并将原始数组存储到_wrapped变量, 并将原始值作为第一个参数调用对应方法

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  // 创建根对象，在浏览器中为window，或者在node中为exports
  var root = this;

  // Save the previous value of the `_` variable.
  // 用来保存"_"中原先的值（如果有的话）
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  // 将内置对象的原型链缓存在局部变量, 以节省字节
  var
    ArrayProto = Array.prototype,
    ObjProto = Object.prototype,
    FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  // 创建js core原生方法的快捷引用
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  // 把我们希望使用的ES5方法引用声明在这里
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  // Underscore对象构造函数
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  // 为不同宿主环境设置引用
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.7.0';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var createCallback = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  // 一个重要的内部函数用来生成可应用到集合中每个元素的回调， 
  // 返回想要的结果 - 无论是等式，任意回调，属性匹配，或属性访问。 
  _.iteratee = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return createCallback(value, context, argCount);
    if (_.isObject(value)) return _.matches(value);
    return _.property(value);
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  // 遍历list中的所有元素，按顺序用遍历输出每个元素。
  // 如果传递了context参数，则把iteratee绑定到context对象上。
  // 每次调用iteratee都会传递三个参数：(element, index, list)。
  // 如果list是个JavaScript对象，iteratee的参数是 (value, key, list))。
  // 返回list以方便链式调用。
  // 
  // 迭代函数通过createCallback封装
  // 对于数组,类数组(如:arguments),采用arr[i]的方式遍历
  // 对于对象:
  // 1. 用_.keys(obj)取出obj中所有的key,返回所有key组成的数组keys
  // 2. 通过keys[i]遍历obj的属性
  // 
  // TODO: 这个函数有个BUG,详情见 [issues](https://github.com/jashkenas/underscore/issues/1590)
  _.each = _.forEach = function(obj, iteratee, context) {
    if (obj == null) return obj;
    iteratee = createCallback(iteratee, context);
    var i, length = obj.length;
    if (length === +length) { // 这种写法是为了确保obj.length是number
      for (i = 0; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  // 通过变换函数（iteratee迭代器 iteratee是可以传一个对象的!）
  // 把list中的每个值映射到一个新的数组中
  // 如果list是个JavaScript对象，iteratee的参数是(value, key, list)。
  // 
  // TODO: 这个函数有个BUG,详情见 [issues](https://github.com/jashkenas/underscore/issues/1590)
  _.map = _.collect = function(obj, iteratee, context) {
    if (obj == null) return [];
    iteratee = _.iteratee(iteratee, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length),
        currentKey;
    for (var index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  // TODO: 还是有同样的bug,我都懒得去github找相应issue了
  _.reduce = _.foldl = _.inject = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index = 0, currentKey;
    if (arguments.length < 3) {
      if (!length) throw new TypeError(reduceError);
      memo = obj[keys ? keys[index++] : index++];
    }
    for (; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // TODO: 还是有同样的bug,我都懒得去github找相应issue了
  _.reduceRight = _.foldr = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== + obj.length && _.keys(obj),
        index = (keys || obj).length,
        currentKey;
    if (arguments.length < 3) {
      if (!index) throw new TypeError(reduceError);
      memo = obj[keys ? keys[--index] : --index];
    }
    while (index--) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    predicate = _.iteratee(predicate, context);
    _.some(obj, function(value, index, list) {
      if (predicate(value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    predicate = _.iteratee(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(_.iteratee(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  // TODO: 老BUG
  _.every = _.all = function(obj, predicate, context) {
    if (obj == null) return true;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    if (obj == null) return false;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (obj.length !== +obj.length) obj = _.values(obj);
    return _.indexOf(obj, target) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  // 在list的每个元素上执行method方法。 任何传递给invoke的额外参数，
  // invoke都会在调用methodName方法的时候传递给它。
  // 如果method是函数,则以每个元素为上下文调用该method,
  // 如果method不是函数,则把method当做元素的方法名来调用.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  // _.map最常使用的用例模型的简化版本 : 萃取对象数组中某属性值，返回一个数组。
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  // _.filter最常使用的用例模型的简化版本 :
  // 遍历obj中的每一个元素，返回一个数组，这个数组包含所有匹配attrs所列键值对的元素
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  // _.find最常使用的用例模型的简化版本 : 返回第一个匹配attrs所列键值对的元素
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element (or element-based computation).
  // 返回obj中的最大值。如果传递iteratee参数，iteratee将作为obj中每个值的排序依据。
  // 如果obj为空，将返回-Infinity，所以你可能需要事先用isEmpty检查 obj 。
  // 
  // TODO: obj.length === +obj.length!
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  // 返回obj中的最小值。如果传递iteratee参数，iteratee将作为obj中每个值的排序依据。
  // 如果obj为空，将返回-Infinity，所以你可能需要事先用isEmpty检查 obj 。
  // 
  // TODO: obj.length === +obj.length!
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // 返回一个随机乱序的 obj 副本, 使用 Fisher-Yates shuffle 来进行随机乱序
  // 
  // TODO: obj.length === +obj.length!
  _.shuffle = function(obj) {
    var set = obj && obj.length === +obj.length ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  // 从 obj中产生一个随机样本。传递一个数字表示从obj中返回n个随机元素。
  // 否则将返回一个单一的随机项.
  // 
  // TODO: obj.length === +obj.length!
  //       guard的目的是?传递guard参数,与不传n参数是一样的效果
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  // 返回一个排序后的obj拷贝副本。如果传递iteratee参数，
  // iteratee将作为obj中每个值的排序依据。
  // 迭代器也可以是字符串的属性的名称进行排序的(比如 length)。
  // 
  // 调用_.map()方法遍历集合, 并将集合中的元素放到value节点, 将元素中需要进行比较的数据放到criteria属性中
  // 调用sort()方法将集合中的元素按照criteria属性中的数据进行顺序排序
  // 调用pluck获取排序后的对象集合并返回
  _.sortBy = function(obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  // _.groupBy, _.indexBy, _.countBy的私有方法,用来处理这些方法的公用逻辑
  // 三者的不同逻辑部分,通过behavior方法传入
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  // 把一个集合分组为多个集合，通过 iterator 返回的结果进行分组. 
  // 如果 iterator 是一个字符串而不是函数, 
  // 那么将使用 iterator 作为各元素的属性名来对比进行分组.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value);
    else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  // 给定一个list，和 一个用来返回一个在列表中的每个元素键 
  // 的iterator 函数（或属性名）， 返回一个每一项索引的对象。
  // 和groupBy非常像，但是当你知道你的键是唯一的时候可以使用indexBy 。
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  // 排序一个列表组成一个组，并且返回各组中的对象的数量的计数。
  // 类似groupBy，但是不是返回列表的值，而是返回在该组中值的数目。
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  // 使用二分查找确定value在list中的位置序号，value按此序号插入能保持list原有的排序
  // 如果提供iterator函数，iterator将作为list排序的依据，包括你传递的value 。
  // iterator也可以是字符串的属性名用来排序(比如length)。
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = low + high >>> 1;
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  // 把obj(任何可以迭代的对象)转换成一个数组，在转换 arguments 对象时非常有用。
  // 
  // TODO: bug about obj.length
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  // 返回obj的长度。
  // 
  // TODO: bug about obj.length
  _.size = function(obj) {
    if (obj == null) return 0;
    return obj.length === +obj.length ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  // 拆分一个数组（array）为两个数组：  第一个数组其元素都满足predicate迭代函数， 
  // 而第二个的所有元素均不能满足predicate迭代函数。
  _.partition = function(obj, predicate, context) {
    predicate = _.iteratee(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------
  // 
  // 
  // _.first 对应 _.last
  // _.initial 对应 _.rest

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  // 返回array（数组）的第一个元素。传递 n参数将返回数组中的前n个元素
  // 
  // TODO:
  //      又出现了这个guard,当指定guard为true时,指定的n无效
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  // 
  // 返回数组中除了最后一个元素外的其他全部元素。 在arguments对象上特别有用。
  // 传递 n参数将从结果中排除数组后面的 n 个元素
  // 设置guard为true同样将忽略设置的n
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  // 返回array（数组）的最后一个元素。传递 n参数将返回数组里的后面的n个元素
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return arra[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  // 
  // 返回数组中除了第一个元素外的其他全部元素。传递 n 参数将返回从n开始的剩余所有元素 。
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  // 返回一个除去所有false值的 array副本。 
  // 在javascript中, false, null, 0, "", undefined 和 NaN 都是false值.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  // strict 如果设置为true,则非数组会被剔除
  var flatten = function(input, shallow, strict, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    for (var i = 0, length = input.length; i < length; i++) {
      var value = input[i];
      if (!_.isArray(value) && !_.isArguments(value)) {// 非数组,非arguments
        if (!strict) output.push(value);
      } else if (shallow) {
        push.apply(output, value);
      } else {
        flatten(value, shallow, strict, output);
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  // 将一个嵌套多层的数组 array（数组） (嵌套可以是任何层数)转换为只有一层的数组。 
  // 如果你传递 shallow参数，数组将只减少一维的嵌套。
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  // 返回array副本,它删除了array之后传入的参数
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  // 返回 array去重后的副本, 使用 === 做相等测试. 如果您确定 array 已经排序, 
  // 那么给 isSorted 参数传递 true值, 此函数将运行的更快的算法. 
  // 如果要处理对象元素, 传参 iterator 来获取要对比的属性.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (array == null) return [];
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = _.iteratee(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = array.length; i < length; i++) {
      var value = array[i];
      if (isSorted) { // 如果是已排序的数组
        if (!i || seen !== value) result.push(value);
        seen = value;
      } else if (iteratee) { // 如果提供了判断函数
        var computed = iteratee(value, i, array);
        if (_.indexOf(seen, computed) < 0) {
          seen.push(computed);
          result.push(value);
        }
      } else if (_.indexOf(result, value) < 0) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  // 返回传入的 arrays（数组）并集：
  // 按顺序返回，返回数组的元素是唯一的，可以传入一个或多个 arrays（数组）
  _.union = function() {
    return _.uniq(flatten(arguments, true, true, []));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  // 返回传入 arrays（数组）交集。结果中的每个值是存在于传入的每个array里
  _.intersection = function(array) {
    if (array == null) return [];
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = array.length; i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  // 返回array中有,而array2中没有的属性
  _.difference = function(array) {
    var rest = flatten(slice.call(arguments, 1), true, true, []);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  // 将 每个arrays中相应位置的值合并在一起。在合并分开保存的数据时很有用. 
  // 如果你用来处理矩阵嵌套数组时, _.zip.apply 可以做类似的效果。
  _.zip = function(array) {
    if (array == null) return [];
    var length = _.max(arguments, 'length').length;
    var results = Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  // 将数组转换为对象。传递任何一个单独[key, value]对的列表，
  // 或者一个键的列表和一个值得列表。 如果存在重复键，最后一个值将被返回。
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    } 
    return result;
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  // 返回value在该 array 中的索引值，如果value不存在 array中就返回-1.
  // 如果传入的isSorted为数字,正数表示从第n位开始擦找,负数表示从右往左第几位
  // 开始查找.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var idx = array.length;
    if (typeof from == 'number') {
      idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
    }
    while (--idx >= 0) if (array[idx] === item) return idx;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  // 一个用来创建整数灵活编号的列表的函数，便于each 和 map循环。
  // 如果省略start则默认为 0；step 默认为 1.
  // 返回一个从start 到stop的整数的列表，用step来增加 （或减少）独占。
  // 值得注意的是，如果stop值在start前面（也就是stop值小于start值），
  // 那么值域会被认为是零长度，而不是负增长。-如果你要一个负数的值域 ，
  // 请使用负数step.
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var Ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  // 绑定函数 function 到对象 object 上, 也就是无论何时调用函数, 
  // 函数里的 this 都指向这个 object. 任意可选参数 arguments 可以传递给函数 
  // function , 可以填充函数所需要的参数, 这也被称为 partial application。
  // 对于没有结合上下文的partial application绑定，请使用partial。 
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    args = slice.call(arguments, 2);
    bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      Ctor.prototype = func.prototype;
      var self = new Ctor;
      Ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (_.isObject(result)) return result;
      return self;
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  // 局部应用一个函数填充在任意个数的 参数，不改变其动态this值。和bind方法很相近。
  // 可以再参数列表中传递_来作为占位符,具体效果看下面例子和源码
  // 
  // eg:
  // var aa = function() {console.log(arguments)}
  // var bb = _.partial(aa, 1, _, 3)
  // bb(2, 4)
  // [1, 2, 3, 4]
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice(); // 替换占位符
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      // 合并参数
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  // Memoizes方法可以缓存某函数的计算结果。对于耗时较长的计算是很有帮助的。
  // 如果传递了 hashFunction 参数，就用 hashFunction 的返回值作为key存储函数的计算结果。 
  // hashFunction 默认使用function的第一个参数作为key。
  // memoized值的缓存  可作为 返回函数的cache属性。
  // 
  // eg: 
  // var fibonacci = _.memoize(function(n) {
  //   return n < 2 ? n: fibonacci(n - 1) + fibonacci(n - 2);
  // });
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = hasher ? hasher.apply(this, arguments) : key;
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  // 延迟执行给定的函数
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  // 创建并返回一个像节流阀一样的函数，当重复调用函数的时候，最多每隔 wait毫秒调用一次该函数。
  // 对于想控制一些触发频率较高的事件有帮助。
  // 默认情况下，throttle将在你调用的第一时间尽快执行这个function，并且，
  // 如果你在wait周期内调用任意次数的函数，都将尽快的被覆盖。如果你想禁用第一次首先执行的话，
  // 传递{leading: false}，还有如果你想禁用最后一次执行的话，传递{trailing: false}。
  // 
  // timeout: 用来保存setTimeout返回的ID, 作用是控制最后一次函数调用
  // previous: 用来保存时间戳,通过和now取差, 判断是否大于函数执行的时间间隔
  // args: 把传递给函数的参数保存在闭包中, 以便于在later中使用
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      // 如果设置了leading: false, 则禁用第一次首先执行,否则给previous赋值当前时间戳
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now(); // 获取当前时间戳
      // 如果previous为零,且禁用第一次首先执行,则给previous赋值为当前时间戳
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      // 计算时间差,看是否执行函数
      if (remaining <= 0 || remaining > wait) {
        clearTimeout(timeout); // 消除计时器
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining); // 不停的覆盖, 直到最后一次才会调用
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  // 返回 function 函数的防反跳版本, 将延迟函数的执行(真正的执行)在函数最后一次调用时刻的 
  // wait 毫秒之后. 对于必须在一些输入（多是一些用户操作）停止到达之后执行的行为有帮助。 
  // 例如: 渲染一个Markdown格式的评论预览, 当窗口停止改变大小之后重新计算布局, 等等.
  // 
  // 传参 immediate 为 true， debounce会在 wait 时间间隔的开始调用这个函数 。
  // 
  // immediate: true
  // 立即执行, 然后再也不会执行func
  // 
  // immediate: false
  // 一直等待,直到func最后一次被触发的wait ms后,才会执行func
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp; // 如果func被重复的调用,timestamp就会被不停的刷新
      // last <= 0 || last >= wait
      if (last < wait && last > 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null; // TODO: 这里有必要判断timeout么?不是在判断之前都赋值null了么
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout; // 从这里可以看出来, immediate: true会使函数立即执行一次
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null; // 执行过之后重置变量
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  // 将第一个函数 function 封装到函数 wrapper 里面, 
  // 并把函数 function 作为第一个参数传给 wrapper. 
  // 这样可以让 wrapper 在 function 运行之前和之后 执行代码, 调整参数然后附有条件地执行.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  // 返回一个新的predicate函数的否定版本。
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  // 返回函数集组合后的复合函数, 也就是一个函数执行完之后把返回的结果再作为参数赋
  // 给下一个函数来执行. 以此类推. 在数学里, 把函数 f(), g(), 和 h() 组合起来可以得到复合函数 f(g(h()))。
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed after being called N times.
  // 创建一个函数, 只有在运行了 times 次之后才有效果. 在处理同组异步请求返回结果时, 
  // 如果你要确保同组里所有异步请求完成之后才 执行这个函数, 这将非常有用。
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed before being called N times.
  // 创建一个函数,调用不超过 times 次。 当count已经达到时，最后一个函数调用的结果 是被记住并返回 。
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      } else {
        func = null;
      }
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  // 创建一个只能调用一次的函数。重复调用改进的方法也没有效果，只会返回第一次执行时的结果。
  // 作为初始化函数使用时非常有用, 不用再设一个boolean值来检查是否已经初始化完成.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  // 获取object对象所有的属性名称
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  // 返回object对象所有的属性值。
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  // 把一个对象转变为一个[key, value]形式的数组。
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  // 返回一个object副本，使其键（keys）和值（values）对换。
  // **Note:** 对于这个操作，必须确保object里所有的( 值都是唯一 && 可以序列号成字符串 ).
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  // 返回一个对象里所有的方法名, 而且是已经排序的 — 也就是说, 对象里每个方法(属性值是一个函数)的名称.
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  // 复制source对象中的所有属性覆盖到destination对象上，并且返回 destination 对象. 
  // 复制是按顺序的, 所以后面的对象属性会把前面的对象属性覆盖掉(如果有重复).
  _.extend = function(obj) {
    if (!_.isObject(obj)) return obj;
    var source, prop;
    for (var i = 1, length = arguments.length; i < length; i++) {
      source = arguments[i];
      for (prop in source) {
        if (hasOwnProperty.call(source, prop)) {
            obj[prop] = source[prop];
        }
      }
    }
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  // 返回一个object副本
  // iteratee是一个断言函数: 返回的对象中包含符合断言函数条件的属性
  // iteratee不是一个函数: obj以后的参数都被当做需要被返回的属性
  // eg: 
  // 
  // _.pick({name: 'moe', age: 50, userid: 'moe1'}, 'name', 'age');
  // => {name: 'moe', age: 50}
  _.pick = function(obj, iteratee, context) {
    var result = {}, key;
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      iteratee = createCallback(iteratee, context);
      for (key in obj) {
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
    } else {
      var keys = concat.apply([], slice.call(arguments, 1));
      obj = new Object(obj); // 主要是处理原始值,
      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        if (key in obj) result[key] = obj[key];
      }
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
   // _.pick 的补集
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(concat.apply([], slice.call(arguments, 1)), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  // 用defaults对象填充object 中的undefined属性。 并且返回这个object。
  // 一旦这个属性被填充，再使用defaults方法将不会有任何效果。
  _.defaults = function(obj) {
    if (!_.isObject(obj)) return obj;
    for (var i = 1, length = arguments.length; i < length; i++) {
      var source = arguments[i];
      for (var prop in source) {
        if (obj[prop] === void 0) obj[prop] = source[prop];
      }
    }
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  // 创建 一个浅复制（浅拷贝）的克隆object。任何嵌套的对象或数组都通过引用拷贝，不会复制。
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  // 用 object作为参数来调用函数interceptor，然后返回object。
  // 这种方法的主要意图是作为函数链式调用 的一环, 为了对此对象执行操作并返回对象本身。
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b; // 确保a b 不是0 -0
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      // 字符串, 数字, 正则表达式, 日期, 布尔值 通过值比较
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      // 正则会呗强制转化为字符串
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        // 如果a b 都是NaN,则判定相等,
        // 之所以要+a,是强制转化为原始值,因为可能 var a = Object(NaN), 而这种情况下a === a
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        // 如果a不为NaN
        // 
        // 同样+a是把a转化为原始值,因为显示调用原始值构造器产生的对象和原始值之间有很多差异,
        // 你可以试试 var a = 0, b = Object(0);
        // 
        // 如果a == 0, 则判断b是0 还是-0,以为 0 === -0, 1/0 !== 1/-0
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        // 强制转化dates和booleans转化为数字原始值,
        return +a === +b;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    // 具有不同构造器的对象不相等,
    var aCtor = a.constructor, bCtor = b.constructor;
    if (
      aCtor !== bCtor &&
      // Handle Object.create(x) cases
      'constructor' in a && 'constructor' in b &&
      !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
        _.isFunction(bCtor) && bCtor instanceof bCtor)
    ) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size, result;
    // Recursively compare objects and arrays.
    if (className === '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size === b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      size = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      result = _.keys(b).length === size;
      if (result) {
        while (size--) {
          // Deep compare each member
          key = keys[size];
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  // 执行两个对象之间的优化深度比较，确定他们是否应被视为相等。
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  // 判断给定的数组,字符串,或者对象是否为空
  // 判断Obj是否哦包含可枚举(能用for in 遍历)属性.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj) || _.isArguments(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  // 1  : ELEMENT_NODE
  // 2  : ATTRIBUTE_NODE
  // 3  : TEXT_NODE
  // 4  : CDATA_SECTION_NODE
  // 5  : ENTITY_REFERENCE_NODE
  // 6  : ENTITY_NODE    
  // 7  : PROCESSING_INSTRUCTION_NODE
  // 8  : COMMENT_NODE
  // 9  : DOCUMENT_NODE
  // 10 : DOCUMENT_TYPE_NODE
  // 11 : DOCUMENT_FRAGMENT_NODE
  // 12 : NOTATION_NODE
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  // 如果object是一个数组，返回true。支持ES5会使用原声方法
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  // 
  // 因为typeof null → 'object', 所以需要!!obj排除null
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  // 对于老的浏览器,没有'[object Arguments]' 采用其它方式判断
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around an IE 11 bug.
  // 
  if (typeof /./ !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  // 对象是否包含给定的键吗？等同于object.hasOwnProperty(key)，
  // 但是使用hasOwnProperty 函数的一个安全引用，以防意外覆盖。
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  // 这个函数看似无用, 但是在Underscore里被用作默认的迭代器iterator.
  // 中间有一种原因就是内部接口统一的需要。因为很多方法都是接受的是一个函数。
  // 但是它使用的值其实就是参数本身。
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  // 返回一个断言函数，这个函数会给你一个断言
  // 可以用来辨别 给定的对象是否匹配attrs指定键/值属性
  // eg:
  // var list = [
  //  {selected: true, visible: true},
  //  {selected: true, visible: true, a: 1},
  //  {selected: true, visible: false}
  // ];
  // var ready = _.matches({selected: true, visible: true});
  // var readyToGoList = _.filter(list, ready);

  // return [
  //  {selected: true, visible: true},
  //  {selected: true, visible: true, a: 1}
  // ];
  // 只有给定的obj包含`selected: true, visible: true`,才能匹配成功
  _.matches = function(attrs) {
    var pairs = _.pairs(attrs), length = pairs.length;
    return function(obj) {
      if (obj == null) return !length;
      obj = new Object(obj);
      for (var i = 0; i < length; i++) {
        var pair = pairs[i], key = pair[0];
        // 如果值或键有一个不匹配,则返回false
        // if( pair[1] === obj[key] && key in obj ) return true; 取反
        if (pair[1] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    };
  };

  // Run a function **n** times.
  // 调用给定的迭代函数n次,每一次调用iteratee传递index参数。生成一个返回值的数组。 
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = createCallback(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  // 指定一个对象的属性, 返回该属性对应的值, 如果该属性对应的是一个函数, 则会执行该函数并返回结果
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? object[property]() : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  // 生成一个唯一的整数id, 可以添加前缀
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    // 模板配置, 如果没有指定配置项, 则使用templateSettings中指定的配置项
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    // 组合模板边界,生成一个新的正则表达式
    // matcher = /<%-([\s\S]+?)%>|<%=([\s\S]+?)%>|<%([\s\S]+?)%>|$/g
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    // eg:
    // var data = { name: 'gooofly', age: 25 };
    // var tpl = '<div><h2><%= name %></h2><p><%- age %></p></div>';
    // var tplFunc = _.template(tpl);
    // 
    var index = 0;
    // 1. 通过正则匹配把tpl模板分割成一个个的片段,并转译特殊字符.
    // 2. 将模板标签替换成js代码段,转化后的结果如下
    // source = "
    // __p+='<div><h2>'+
    // ((__t=( name ))==null?'':__t)+
    // '</h2><p>'+
    // ((__t=( age ))==null?'':_.escape(__t))+
    // '</p></div>';
    // "
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      // 截取片段
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";


    // 3. 检测是否配置了setting.variable, 如果没有配置就给上面生成的js片段包裹作用域
    // 默认的, template 通过 with 语句 来取得 data 所有的值. 
    // 您也可以在 variable 设置里指定一个变量名. 这样能显著提升模板的渲染速度.
    // 
    // If a variable is not specified, place data values in local scope.
    // source = "
    // with(obj||{}){
    // __p+='<div><h2>'+
    // ((__t=( name ))==null?'':__t)+
    // '</h2><p>'+
    // ((__t=( age ))==null?'':_.escape(__t))+
    // '</p></div>';
    // }
    // "
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    // 4. 继续在js片段外围包裹变量申明和return语句
    // 
    // source = "
    // var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
    // with(obj||{}){
    // __p+='<div><h2>'+
    // ((__t=( name ))==null?'':__t)+
    // '</h2><p>'+
    // ((__t=( age ))==null?'':_.escape(__t))+
    // '</p></div>';
    // }
    // return __p;
    // "
    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    // 5. 通过Function创建模板渲染函数
    // 
    // render = function ( obj, _ ) {
    // var
    //   __t,
    //   __p='',
    //   __j=Array.prototype.join,
    //   print = function () {
    //     __p += __j.call( arguments, '' );
    //   };
    //  
    // with ( obj || {} ) {
    //   __p+='<div><h2>'+
    //   ((__t=( name ))==null?'':__t)+
    //   '</h2><p>'+
    //   ((__t=( age ))==null?'':_.escape(__t))+
    //   '</p></div>';
    // }
    // 
    // return __p;
    // }
    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    // 返回编译后的模板渲染函数
    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.
  // 
  // underscore的链式写法通过_.chain中的_chain属性控制,设置为true表示采用链式写法.
  // 通过_.mixin将_上的静态方法包装后复制到_的原型对象上
  // 然后私有方法result通过检查_chain属性来返回_()包装对象来达到链式写法的目的
  // 

  // Helper function to continue chaining intermediate results.
  // 用于协助函数继续使用链式写法. 当链式写法开关被打开时,返回_实例, 否则返回原对象µ
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  // 将自定义函数添加到underscore对象和原型对象上
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      // 将函数改造后复制到_的原型对象上面.
      _.prototype[name] = function() {
        var args = [this._wrapped]; // 原参数被挂到_wrapped下面
        push.apply(args, arguments); // 合并参数
        // 执行相应函数,并使用私有的result实现链式调用
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  // 将_的静态方法复制到_的原型对象上去
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  // 将部分原生的数组方法复制到_的原型对象上去,并且支持链式写法
  // 因此_的实例对象也能够直接调用原生数组方法
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      // IE bugs with splice() and shift(), failing to remove the 0 indexed value, when using an array-like-object with _(...).
      // look to [issues #397](https://github.com/jashkenas/underscore/issues/397)
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj); // 使支持链式操作
    };
  });

  // Add all accessor Array functions to the wrapper.
  // 作用同于上一段代码, 将数组中的一些方法添加到Underscore对象, 并支持了方法链操作
  // 区别在于上一段代码所添加的函数, 均返回Array对象本身(也可能是封装后的Array), 
  // concat, join, slice方法将返回一个新的Array对象(也可能是封装后的Array)
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  // 返回被封装的_对象的原始值(存放在_wrapped属性中)
  _.prototype.value = function() {
    return this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));