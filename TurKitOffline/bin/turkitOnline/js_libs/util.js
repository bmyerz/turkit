
/**
 * Prints s to the output buffer.
 */
function print(s) {
	__java.print(s)
}

/**
 * Prints s if props.verbose is true.
 */
function verbosePrint(s) {
	if (props.verbose) {
		print(s)
	}
}

/**
 * Makes a REST request to MTurk, and returns the result as an XML object.
 */
function mTurkRestRequest(operation, params) {
    // make sure we have enough time
    if ((__deadline > 0) && (time() > __deadline - 5 * 1000)) {
        crash("not enough time -- we'll try doing more next time")
    }

	if (props.mode == "real" || props.mode == "sandbox") {
		if (!params) params = []
		var x = new XML(__java.mTurkRestRequest(props.awsId, props.awsKey,
			props.mode == "sandbox", operation, params))
		if ('' + x..Request.IsValid != "True") throw "MTurk error: " + operation + " failed: " + x
		return x
	} else if (props.mode == "offline") {
		throw "can't make REST requests in offline mode."
	} else {
		throw "unknown mode"
	}
}

/**
 * Sleeps for the specified number of seconds.
*/
function sleep(seconds) {
	__java.sleep(Math.floor(1000 * seconds))
}

/**
 * Returns the md5 hash of the given string.
 */
function md5(s) {
	return "" + __java.md5(s)
}

/**
 * Returns a JSON-like representation of the JavaScript data value or object o.
 * You may call "eval" on the result and get back the original data structure.
 * This works if the structure contains nested or even circular references.
 * It does not handle functions.
 */
function json(o) {
	return "" + __java.json(o)
}

/**
	Reads the contents of the given url or file into a string.
	All urls must start with "http://" or "https://"
 */
function read(src) {
	return "" + __java.read(src)
}

/**
	Pseudonym for {@link read}.
 */
function slurp(src) {
	return read(src)
}

/**
	Writes to the given file.
 */
function write(dest, s) {
	return __java.write(dest, s)
}

/**
	Tells MTurk to notify us if the given HIT changes.
	This will in-turn trigger a re-run of the entire program,
	and hopefully we'll get further that time,
	since presumably a HIT will have been completed.
 */
function registerMTurkNotification(hitId) {
	return __java.registerMTurkNotification(props.awsId, props.awsKey, props.mode, hitId)
}

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

/**
    Returns a random number uniformly distributed between 0 and 1.
    This function overrides the normal Math.random function as well.
    
    <p>NOTE: The normal JavaScript Math.random uses a random seed each time the script is run.
    TurKit uses the same seed between crash-and-reruns of a script,
    unless you explicitly set it with {@link setSeed}.</p>
*/
function random() {
	return __java.random()	
}
Math.random = random

/**
    Sets the random seed used by {@link random}.
*/
function setSeed(seed) {
	__java.setSeed(seed)	
}
setSeed(ensure(__db, ['randomSeed'], new Date().getTime()))

/**
 * Swaps the values at the two provided indecies (<code>i1</code>, <code>i2</code>)
 * in the provided array <code>o</code>.
 * 
 * Example:
 * <pre>
 * a = [1, 2, 3]
 * swap(a, 0, 2)
 * // a is now [3, 2, 1]
 * </pre>
 */
function swap(o, i1, i2) {
    var temp = o[i1]
    o[i1] = o[i2]
    o[i2] = temp
}

/**
 * Randomly sorts the elements of the given array.
 */
function shuffle(a) {
    for (var i = 0; i < a.length; i++) {
        swap(a, i, randomIndex(a.length))
    }
    return a
}

/**
 * Returns an integer in the range [0, n - 1].
 */
function randomIndex(n) {
    return Math.floor(Math.random() * n)
}

/**
    Returns the current time in milliseconds since the UNIX epoc.
*/
function time() {
    return new Date().getTime()
}

/**
	Groups the values in the object or array <code>a</code>
	by the key defined for each value by running <code>func</code> on that value.
	The result is a map of keys to arrays, where each array holds all the values associated with that key.	
 */
function group(a, func) {
    var m = {}
    foreach(a, function (e) {
        var key = func(e)
        var arr = m[key]
        if (!arr) {
            arr = []
            m[key] = arr
        }
        arr.push(e)
    })
    return m
}

// adapted from "parse" function at http://json.org/json.js
/**
    Returns true if it is safe to call eval on s, i.e., calling eval on s will not have any side effects aside from creating a data structure.
*/
function safeJson(s) {
	var safeJson_re = /(\s+|[\(\)\{\}\[\]=:,]|'(\\\'|[^'])*'|"(\\\"|[^"])*"|[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?|function|var|data|return|true|false|undefined|null|\/\*(\*+[^\*\/]|[^\*])*\*+\/)+/
	var m = s.match(safeJson_re)
	return m && (m[0] == s)
}

/**
    Ensures that a JavaScript path exists, assigns a default value to the path if it doesn't exist yet, and returns the value in either case. There are multiple ways to call this function. All of the following are equivalent:<br>
    <code>
        ensure("a.b[2].c", 5)<br>
        ensure(null, "a.b[2].c", 5)<br>
        ensure(a, "b[2].c", 5)<br>
        ensure(a, ".b[2].c", 5)<br>
        ensure(a, ["b", 2, "c"], 5)<br>
        <br>
        print(a.b[2].c)<br>
        <br>
    </code>
    The last line prints "5". Note that the last 3 versions only work if <code>a</code> is already an object.
*/
function ensure(obj, path, defaultValue) {
    if (typeof obj == "string") {
        return ensure(null, obj, path)
    }
    if (obj && (typeof path == "string") && path.match(/^[^\[\.]/)) {
        return ensure(obj, '.' + path, defaultValue)
    }
    
    if (defaultValue == undefined) {
        defaultValue = {}
    }
    
    var so_far = obj ? "obj" : ""
    if (typeof path == "string") {
        var parts = path.match(/(^|\.)\w+|\[('(\\'|[^'])*'|"(\\"|[^"])*"|[^\]]+)\]/g)
    } else {
        var parts = map(path, function (part, i) { return (i == 0 && so_far == "") ? part : '[' + json(part) + ']' })
    }
    foreach(parts, function (part, i) {
        so_far += part
        if (eval("typeof " + so_far) == "undefined") {
            if (i < parts.length - 1) {
                if (parts[i + 1].match(/\[\d+\]/)) {
                    eval(so_far + " = []")
                } else {
                    eval(so_far + " = {}")
                }
            } else {
                eval(so_far + " = defaultValue")
            }
        }
    })
    return eval(so_far)
}

/**
    Returns an array of the values in an object.
    @type Array
*/
function values(obj) {
	var a = []
	foreach(obj, function(e) {
				a.push(e)
			})
	return a
}

/**
    Returns the keys of an object as an array.
    @type Array
*/
function keys(obj) {
	var a = []
	foreach(obj, function(v, k) {
				a.push(k)
			})
	return a
}

/**
    Filters values of an array or object using the <i>test</i> function; the original object is not affected.
    The test function should accept one or two parameters.
    The first parameter will be the value to process.
    The second parameter will be the index of that value in the array,
    or the key of that value in the object.
    The function should return true or false depending on whether the value should pass the filter.
*/
function filter(a, test) {
	if (typeof test == "string") {
		var testString = test
		test = function(v, k) {
			var i = k
			var e = v
			return eval(testString)
		}
	}
	if (a instanceof Array) {
		var b = []
		for (var i = 0; i < a.length; i++) {
			var v = a[i]
			if (test(v, i)) {
				b.push(v)
			}
		}
		return b
	} else if ((typeof a) == "xml") {
		var b = []
		for (var i = 0; i < a.length(); i++) {
			var v = a[i]
			if (test(v, i)) {
				b.push(v)
			}
		}
		return b
	} else {
		var b = {}
		for (var k in a) {
			if (a.hasOwnProperty(k)) {
				var v = a[k]
				if (test(v, k)) {
					b[k] = v
				}
			}
		}
		return b
	}
}

/**
    Processes values of an array or object using the <i>test</i> function; the original object is not affected.
    The test function should accept one or two parameters.
    The first parameter will be the value to process.
    The second parameter will be the index of that value in the array,
    or the key of that value in the object.
    If the test function returns false for a value, then the processing will stop.
*/
function foreach(a, test) {
	if (typeof test == "string") {
		var testString = test
		test = function(v, k) {
			var i = k
			var e = v
			return eval(testString)
		}
	}
	if (a instanceof Array) {
		for (var i = 0; i < a.length; i++) {
			if (test(a[i], i) == false)
				break
		}
	} else if ((typeof a) == "xml") {
		for (var i = 0; i < a.length(); i++) {
			if (test(a[i], i) == false)
				break
		}
	} else {
		for (var k in a) {
			if (a.hasOwnProperty(k)) {
				if (test(a[k], k) == false)
					break
			}
		}
	}
	return a
}

/**
    Maps values of an array or object using the <i>test</i> function into a new array or object with the same indicies;
    the original object is not affected.
    The test function should accept one or two parameters.
    The first parameter will be the value to process.
    The second parameter will be the index of that value in the array,
    or the key of that value in the object.
    The test function should return a value which will be placed
    in a newly constructed array or object at the index or key of this value.
*/
function map(a, test) {
	if (typeof test == "string") {
		var testString = test
		test = function(v, k) {
			var i = k
			var e = v
			return eval(testString)
		}
	}
	if (a instanceof Array) {
		var b = []
		for (var i = 0; i < a.length; i++) {
			b.push(test(a[i], i))
		}
		return b
	} else if ((typeof a) == "xml") {
		var b = []
		for (var i = 0; i < a.length(); i++) {
			b.push(test(a[i], i))
		}
		return b
	} else {
		var b = {}
		for (var k in a) {
			if (a.hasOwnProperty(k)) {
				b[k] = test(a[k], k)
			}
		}
		return b
	}
}

/**
    Similar to {@link map}, except that it overwrites <code>a</code> with the results,
    rather than returning a new object or array.
*/
function mapToSelf(a, test) {
    if (typeof test == "string") {
        var testString = test
        test = function (v, k) {
            var i = k
            var e = v
            return eval(testString)
        }
    }
    if (a instanceof Array) {
        for (var i = 0; i < a.length; i++) {
            a[i] = test(a[i], i)
        }
        return a
    } else {
        for (var k in a) {
            if (a.hasOwnProperty(k)) {
                a[k] = test(a[k], k)
            }
        }
        return a
    }
}

/**
 * Folds the given array or object a using func.
 * The func function should accept two parameters.
 * Each parameter will be a value from a,
 * or the default value def (if it is supplied),
 * or a return value from a previous call to func.
 * Every element of a will be passed to func exactly once,
 * in the order they appear in a.
 * The return value is the final value returned from func.
 * 
 * This function can be used to sum a list of numbers, for example.
 * 
 */
function fold(a, func, def) {
	if (def === undefined) {
		var ret = null
		var first = true
		foreach(a, function (e, i) {
			if (first) {
				ret = e
				first = false
			} else {
				ret = func(e, ret, i)
			}
		})
		return ret	
	} else {
		var ret = def
		foreach(a, function (e, i) {
			ret = func(e, ret, i)
		})	
		return ret
	}
}

/**
    Removes whitespace from the front and back of the string.
*/
function trim(s) {
    return s.replace(/^\s+|\s+$/g,"");
}

/**
    Returns the last element of this array.
*/
function last(a) {
	return a[a.length - 1]
}

/**
    Adds the key/value pairs found in <i>objB</i> to <i>objA</i>.
    For example:<br>
    <code>
        merge({a:1, b:2}, {c:3, d:4})
    </code><br>
    returns <code>{a:1, b:2, c:3, d:4}</code>
*/
function merge(objA, objB) {
	foreach(objB, function(v, k) {
				objA[k] = v
			})
	return objA
}

/**
    Returns three values in an array:
    the index or key of the max element,
    the max element,
    the value associated with the max element (i.e. score(maxElement)),
    which is equal to the max element is no score function is provided.
*/
function maxHelper(a, score) {
    if (score == null) {
        score = function (v, k) {
            return v
        }
    } else if (typeof score == "string") {
        var scoreString = score
        score = function (v, k) {
            var i = k
            var e = v
            return eval(scoreString)
        }
    }
    if (a instanceof Array) {
        var bestScore = null
        var bestElement = null
        var bestIndex = null
        for (var i = 0; i < a.length; i++) {
            var v = a[i]
            var s = score(v, i)
            if (bestElement == null || s > bestScore) {
                bestScore = s
                bestElement = v
                bestIndex = i
            }
        }
        return [bestIndex, bestElement, bestScore]
    } else {
        var bestScore = null
        var bestElement = null
        var bestIndex = null
        for (var k in a) {
            if (a.hasOwnProperty(k)) {
                var v = a[k]
                var s = score(v, k)
                if (bestElement == null || s > bestScore) {
                    bestScore = s
                    bestElement = v
                    bestIndex = k
                }
            }
        }
        return [bestIndex, bestElement, bestScore]
    }
}

/**
    Returns the max element.
 */
function max(a, score) {
    return maxHelper(a, score)[1]
}

/**
    Returns the index of the max element
 */
function findMax(a, score) {
    return maxHelper(a, score)[0]
}

/**
	Escape the string for use inside XML, e.g., convert characters like &amp; into &amp;amp;.
 */
escapeXml = function (s) {
    s = s.replace(/&/g, "&amp;")
    s = s.replace(/</g, "&lt;").
        replace(/>/g, "&gt;").
        replace(/'/g, "&apos;").
        replace(/"/g, "&quot;").
//            replace(/[\u0000-\u001F]|[\u0080-\uFFFF]/g, function (c) {
        replace(/[\u0080-\uFFFF]/g, function (c) {
            var code = c.charCodeAt(0)
            return '&#' + code + ';'
            // if we want hex:
            var hex = code.toString(16)
            return '&#x' + hex + ';'
        })
    return s;
}

/**
	Unescape a string with XML escape codes, e.g., convert sequences like &amp;amp; into &amp;.
 */
unescapeXml = function (s) {
    return s.replace(/&[^;]+;/g, function (s) {
        switch(s.substring(1, s.length - 1)) {
            case "amp":  return "&";
            case "lt":   return "<";
            case "gt":   return ">";
            case "apos": return "'";
            case "quot": return '"';
            default:
                if (s.charAt(1) == "#") {
                    if (s.charAt(2) == "x") {
                        return String.fromCharCode(parseInt(s.substring(3, s.length - 1), 16));
                    } else {
                        return String.fromCharCode(parseInt(s.substring(2, s.length - 1)));
                    }
                } else {
                    throw new java.lang.Exception("unknown XML escape sequence: " + s)
                }
        }
    })
}

/**
	Returns a new Set. A set is represented as an object where the values are true for keys in the set.
	If <code>a</code> is a set, add it's elements to this set.
	If <code>a</code> is an object, add it's values to this set.
	If <code>a</code> is an element, add it to this set.
 */
function Set(a) {
	if (a) {
    	this.add(a)
    }
}

/**
	Returns a clone of the Set.
 */
Set.prototype.clone = function () {
    return new Set(this)
}

/**
	If <code>a</code> is a set, remove it's elements from this set.
	If <code>a</code> is an object, remove it's values from this set.
	If <code>a</code> is an element, remove it from this set.
	
	Returns this Set, after the removal.
	If removing a single element, returns <code>true</code> iff the element existed before.
 */
Set.prototype.remove = function (a) {
    if ((typeof a) == "object") {
        var me = this
        if (a instanceof Set) {
            foreach(a, function (_, a) {
                delete me[a]
            })
        } else {
            foreach(a, function (a) {
                delete me[a]
            })
        }
    } else {
        if (!this[a]) return false
        delete this[a]
        return true
    }
    return this
}

/**
	If <code>a</code> is a set, add it's elements to this set.
	If <code>a</code> is an object, add it's values to this set.
	If <code>a</code> is an element, add it to this set.
	
	Returns this Set, after the addition.
	If adding a single element, returns <code>true</code> iff the element didn't exist before.
 */
Set.prototype.add = function (a) {
    if ((typeof a) == "object") {
        var me = this
        if (a instanceof Set) {
            foreach(a, function (_, a) {
                me[a] = true
            })
        } else {
            foreach(a, function (a) {
                me[a] = true
            })
        }
    } else {
        if (this[a]) return false
        this[a] = true
        return true
    }
    return this
}

/**
	Returns a new Set representing the intersection of this Set with <code>a</code>.
	If <code>a</code> is an object, a set is created from its values, and the intersection is done with that.
	If <code>a</code> is an element, a set is created containing this element, and the intersection is done with that.
 */
Set.prototype.intersect = function (b) {
    var i = new Set()
    if ((typeof a) == "object") {
        var me = this
        if (a instanceof Set) {
            foreach(a, function (_, a) {
            	if (me[a]) i[a] = true
            })
        } else {
            foreach(a, function (a) {
            	if (me[a]) i[a] = true
            })
        }
    } else {
    	if (this[a]) i[a] = true
    }
    return i
}

/**
	Returns a new Bag data structure,
	which is an unordered collection of objects,
	where objects can appear multiple times.
	The bag is really a map of keys,
	where the value associated with each key
	represents the number of times that key appears in the bag.
	
	If <code>a</code> is a bag, add it's elements to this bag.
	If <code>a</code> is an object, add it's values to this bag.
	If <code>a</code> is an element, add it to this bag.
 */
function Bag(a) {
	if (a) {
		this.add(a)
	}
}

/**
	Returns a clone of the bag.
 */
Bag.prototype.clone = function () {
    return new Bag(this)
}

/**
	If <code>a</code> is a bag, add it's elements to this bag, and returns the new bag.
	If <code>a</code> is an object, add it's values to this bag, and returns the new bag.
	If <code>a</code> is an element, add it to this bag, and return the new number of times it appears.
	
	The parameter <code>count</code> defaults to 1,
	but can be changed to add multiple copies of <code>a</code> to the bag.
 */
Bag.prototype.add = function (a, count) {
	if (count === undefined) count = 1
	if ((typeof a) == "object") {
		var me = this
		if (a instanceof Bag) {
			foreach(a, function (v, a) {
				me.add(a, v * count)
			})
		} else {
			foreach(a, function (a) {
				me.add(a, count)
			})
		}
	} else {
		var v = this[a]
		if (!v) v = 0
		v += count
		this[a] = v
		return v
	}
	return this
}

/**
	Get's the number of <code>a</code>'s in the bag.
	
	This is different than myBag['item'],
	since doing that would return null instead of 0,
	if there was no 'item' in myBag.
 */
Bag.prototype.get = function (a) {
	var v = this[a]
	if (!v) return 0
	return v
}

/**
 * see documentation here: <a href="http://goessner.net/articles/JsonPath/">http://goessner.net/articles/JsonPath/</a>
 * 
 * from: http://code.google.com/p/jsonpath/
 * 
 * JSONPath 0.8.0 - XPath for JSON
 *
 * Copyright (c) 2007 Stefan Goessner (goessner.net)
 * Licensed under the MIT (MIT-LICENSE.txt) licence.
 */
function jsonPath(obj, expr, arg) {
   var P = {
      resultType: arg && arg.resultType || "VALUE",
      result: [],
      normalize: function(expr) {
         var subx = [];
         return expr.replace(/[\['](\??\(.*?\))[\]']/g, function($0,$1){return "[#"+(subx.push($1)-1)+"]";})
                    .replace(/'?\.'?|\['?/g, ";")
                    .replace(/;;;|;;/g, ";..;")
                    .replace(/;$|'?\]|'$/g, "")
                    .replace(/#([0-9]+)/g, function($0,$1){return subx[$1];});
      },
      asPath: function(path) {
         var x = path.split(";"), p = "$";
         for (var i=1,n=x.length; i<n; i++)
            p += /^[0-9*]+$/.test(x[i]) ? ("["+x[i]+"]") : ("['"+x[i]+"']");
         return p;
      },
      store: function(p, v) {
         if (p) P.result[P.result.length] = P.resultType == "PATH" ? P.asPath(p) : v;
         return !!p;
      },
      trace: function(expr, val, path) {
         if (expr) {
            var x = expr.split(";"), loc = x.shift();
            x = x.join(";");
            if (val && val.hasOwnProperty(loc))
               P.trace(x, val[loc], path + ";" + loc);
            else if (loc === "*")
               P.walk(loc, x, val, path, function(m,l,x,v,p) { P.trace(m+";"+x,v,p); });
            else if (loc === "..") {
               P.trace(x, val, path);
               P.walk(loc, x, val, path, function(m,l,x,v,p) { typeof v[m] === "object" && P.trace("..;"+x,v[m],p+";"+m); });
            }
            else if (/,/.test(loc)) { // [name1,name2,...]
               for (var s=loc.split(/'?,'?/),i=0,n=s.length; i<n; i++)
                  P.trace(s[i]+";"+x, val, path);
            }
            else if (/^\(.*?\)$/.test(loc)) // [(expr)]
               P.trace(P.eval(loc, val, path.substr(path.lastIndexOf(";")+1))+";"+x, val, path);
            else if (/^\?\(.*?\)$/.test(loc)) // [?(expr)]
               P.walk(loc, x, val, path, function(m,l,x,v,p) { if (P.eval(l.replace(/^\?\((.*?)\)$/,"$1"),v[m],m)) P.trace(m+";"+x,v,p); });
            else if (/^(-?[0-9]*):(-?[0-9]*):?([0-9]*)$/.test(loc)) // [start:end:step]  phyton slice syntax
               P.slice(loc, x, val, path);
         }
         else
            P.store(path, val);
      },
      walk: function(loc, expr, val, path, f) {
         if (val instanceof Array) {
            for (var i=0,n=val.length; i<n; i++)
               if (i in val)
                  f(i,loc,expr,val,path);
         }
         else if (typeof val === "object") {
            for (var m in val)
               if (val.hasOwnProperty(m))
                  f(m,loc,expr,val,path);
         }
      },
      slice: function(loc, expr, val, path) {
         if (val instanceof Array) {
            var len=val.length, start=0, end=len, step=1;
            loc.replace(/^(-?[0-9]*):(-?[0-9]*):?(-?[0-9]*)$/g, function($0,$1,$2,$3){start=parseInt($1||start);end=parseInt($2||end);step=parseInt($3||step);});
            start = (start < 0) ? Math.max(0,start+len) : Math.min(len,start);
            end   = (end < 0)   ? Math.max(0,end+len)   : Math.min(len,end);
            for (var i=start; i<end; i+=step)
               P.trace(i+";"+expr, val, path);
         }
      },
      eval: function(x, _v, _vname) {
         try { return $ && _v && eval(x.replace(/@/g, "_v")); }
         catch(e) { throw new SyntaxError("jsonPath: " + e.message + ": " + x.replace(/@/g, "_v").replace(/\^/g, "_a")); }
      }
   };

   var $ = obj;
   if (expr && obj && (P.resultType == "VALUE" || P.resultType == "PATH")) {
      P.trace(P.normalize(expr).replace(/^\$;/,""), obj, "$");
      return P.result.length ? P.result : false;
   }
} 

/**
 * Utility methods for doing statistics. More to come here in the future.
 */
stats = {}

/**
 * Calculate the sum of an array
 */
stats.sum = function (a) {
	return fold(a, function (x, y) { return x + y }, 0)
}

/**
	Calculate the mean of an array.
	<code>sum</code> is optional -- it will be calculated if not supplied. 
 */
stats.mean = function (a, sum) {
	if (!(a instanceof Array)) a = values(a)
	if (sum === undefined) {
		sum = stats.sum(a)
	}
	return sum / a.length
}

/**
	Calculate the variance of an array.
	<code>mean</code> is optional -- it will be calculated if not supplied. 
 */
stats.variance = function (a, mean) {
	if (!(a instanceof Array)) a = values(a)
	if (!mean) {
		mean = stats.mean(a)
	}
	return fold(a, function (x, y) {
		return Math.pow(x - mean, 2) + y
	}, 0) / (a.length - 1)
}

/**
	Calculate the standard deviation of an array.
	<code>mean</code> is optional -- it will be calculated if not supplied. 
 */
stats.sd = function (a, mean) {
	return Math.sqrt(stats.variance(a, mean))
}

/**
	Calculate the sum, mean, variance and standard deviation of <code>a</code>.
 */
stats.all = function (a) {
	if (!(a instanceof Array)) a = values(a)
	var ret = {}
	ret.sum = stats.sum(a)
	ret.mean = stats.mean(a, ret.sum)
	ret.variance = stats.variance(a, ret.mean)
	ret.sd = Math.sqrt(ret.variance)
	return ret
}

/**
	<p>Takes two strings <code>a</code> and <code>b</code>, and calculates their differences.
	The differences are highlighted in each result using HTML span tags with yellow backgrounds.
	There are two resulting strings of HTML, returned in an object with two properties, <code>a</code> and <code>b</code>.</p>
 */
function highlightDiff(a, b) {
    a = a.match(/\w+|\S+|\s+/g)
    if (!a) a = []
    b = b.match(/\w+|\S+|\s+/g)
    if (!b) b = []
    mapToSelf(a, function (e) { return ":" + e })
    mapToSelf(b, function (e) { return ":" + e })
    diff(a, b)
    function toHTML(tokens) {
        var yellow = false
        var s = []
        foreach(tokens, function (token) {
            if (typeof token == "string") {
                if (!yellow) {
                    yellow = true
                    s.push('<span style="background-color:yellow">')
                }
                s.push(escapeXml(token.substring(1)))
            } else {
                if (yellow) {
                    yellow = false
                    s.push('</span>')
                }
                s.push(escapeXml(token.text.substring(1)))
            }        
        })
        if (yellow) {
            yellow = false
            s.push('</span>')
        }
        return s.join('')
    }
    return {
        a : toHTML(a),
        b : toHTML(b)
    }
    
	// much of the "diff" function below comes from the web, but I forget where,
	// please let me know if you know the source
    function diff( o, n ) {
      var ns = new Object();
      var os = new Object();
      
      for ( var i = 0; i < n.length; i++ ) {
        if ( ns[ n[i] ] == null )
          ns[ n[i] ] = { rows: new Array(), o: null };
        ns[ n[i] ].rows.push( i );
      }
      
      for ( var i = 0; i < o.length; i++ ) {
        if ( os[ o[i] ] == null )
          os[ o[i] ] = { rows: new Array(), n: null };
        os[ o[i] ].rows.push( i );
      }
      
      for ( var i in ns ) {
        if ( ns[i].rows.length == 1 && typeof(os[i]) != "undefined" && os[i].rows.length == 1 ) {
          n[ ns[i].rows[0] ] = { text: n[ ns[i].rows[0] ], row: os[i].rows[0] };
          o[ os[i].rows[0] ] = { text: o[ os[i].rows[0] ], row: ns[i].rows[0] };
        }
      }
      
      for ( var i = 0; i < n.length - 1; i++ ) {
        if ( n[i].text != null && n[i+1].text == null && n[i].row + 1 < o.length && o[ n[i].row + 1 ].text == null && 
             n[i+1] == o[ n[i].row + 1 ] ) {
          n[i+1] = { text: n[i+1], row: n[i].row + 1 };
          o[n[i].row+1] = { text: o[n[i].row+1], row: i + 1 };
        }
      }
      
      for ( var i = n.length - 1; i > 0; i-- ) {
        if ( n[i].text != null && n[i-1].text == null && n[i].row > 0 && o[ n[i].row - 1 ].text == null && 
             n[i-1] == o[ n[i].row - 1 ] ) {
          n[i-1] = { text: n[i-1], row: n[i].row - 1 };
          o[n[i].row-1] = { text: o[n[i].row-1], row: i - 1 };
        }
      }
      
      return { o: o, n: n };
    }
}
