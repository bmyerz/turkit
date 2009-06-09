
/**
    A thin wrapper around Java's System.out.println(s)
*/
function print(s) {
	Packages.java.lang.System.out["println(java.lang.Object)"](s)
}

/**
    Sleep for the specified number of seconds using Java's Thread.sleep
*/
function sleep(seconds) {
	Packages.java.lang.Thread.sleep(Math.floor(1000 * seconds))
}

/**
    Wraps Java's System.currentTimeMillis(). Returns the current time in milliseconds.
*/
function time() {
    return Packages.java.lang.System.currentTimeMillis()
}

/**
    Returns a JSON-like representation of the JavaScript data value. You may call "eval" on the result and get back the original data structure. This works even if the structure contains nested or even circular references. It does not handle functions.
    @param o The data value to convert. May be a number, string, array or object.
    @returns A JSON-like representation of o.
    @type String
*/
function json(o) {
	return "" + Packages.edu.mit.csail.uid.turkit.RhinoJson.json(o)
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
    Filters values of an array or object using the <i>test</i> function; the original object is not affected.<br>
    For example:<br>
    <code>filter({a:5,b:7,c:3}, function (e) {return e >= 5})</code><br>
    returns <code>{a:5,b:7}</code>.<br>
    You may also use a string for <i>test</i> like so:<br>
    <code>filter({a:5,b:7,c:3}, "e >= 5")</code>.<br>
    Note that <i>e</i> is a special value in the string.
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
    Processes values of an array or object using the <i>test</i> function; the original object is not affected.<br>
    For example:<br>
    <code>foreach({a:5,b:7,c:3}, function (e) {print(e)})</code><br>
    prints 5, 7, 3<br>
    You may also use a string for <i>test</i> like so:<br>
    <code>foreach({a:5,b:7,c:3}, "print(e)")</code>.<br>
    Note that <i>e</i> is a special value in the string. Another special value is <i>i</i>, which is the index or key of the current element.
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
    Maps values of an array or object using the <i>test</i> function; the original object is not affected.<br>
    For example:<br>
    <code>map({a:5,b:7,c:3}, function (e) {return e + 1})</code><br>
    returns <code>{a:6,b:8,c:4}</code>.<br>
    You may also use a string for <i>test</i> like so:<br>
    <code>map({a:5,b:7,c:3}, "e + 1")</code>.<br>
    Note that <i>e</i> is a special value in the string. Another special value is <i>i</i>, which is the index or key of the current element.
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
    Returns the last element of this array.
*/
Array.prototype.last = function() {
	return this[this.length - 1]
}

/**
    Returns a deep clone of <i>o</i> up to the specified <i>depth</i>.<br>
    For example:<br>
    <code>
        prune({a:{b:5},c:[1,2,3]}, 1)
    </code><br>
    Returns <code>{a:{},c:[]}</code>
*/
function prune(o, depth) {
	if (depth === undefined)
		depth = 1
	if (o instanceof Array) {
		var newO = []
	} else {
		var newO = {}
	}
	if (depth > 0) {
		foreach(o, function(v, k) {
					if ((typeof v) == "object") {
						v = prune(v, depth - 1)
					}
					newO[k] = v
				})
	}
	return newO
}

/**
    Adds the key/value pairs found in <i>objB</i> to <i>objA</i>.<br>
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
    Passes each value of an array or object through the <i>test</i> function, and returns the maximum value found.<br>
    For example:<br>
    <code>getMax({a:5,b:7,c:3}, function (e) {return e})</code><br>
    returns 7<br>
    You may also use a string for <i>test</i> like so:<br>
    <code>getMax({a:5,b:7,c:3}, "e")</code>.<br>
    Note that <i>e</i> is a special value in the string. Another special value is <i>i</i>, which is the index or key of the current element. If you omit a value for <i>test</i>, the default is "e".
    @param a An array or object.
    @param test Each element in <i>a</i> is passed through this. The default is the identity function.    
*/
function getMax(a, test) {
    if (test == null) {
        test = function (v, k) {
            return v
        }
    } else if (typeof test == "string") {
        var testString = test
        test = function (v, k) {
            var i = k
            var e = v
            return eval(testString)
        }
    }
    if (a instanceof Array) {
        var bestScore = null
        var bestElement = null
        var bestIndex = null
        for (var i = 0; i < a.length; i++) {
            var v = a[i]
            var score = test(v, i)
            if (bestElement == null || score > bestScore) {
                bestScore = score
                bestElement = v
                bestIndex = i
            }
        }
        return [bestElement, bestIndex]
    } else {
        var bestScore = null
        var bestElement = null
        var bestIndex = null
        for (var k in a) {
            if (a.hasOwnProperty(k)) {
                var v = a[k]
                var score = test(v, k)
                if (bestElement == null || score > bestScore) {
                    bestScore = score
                    bestElement = v
                    bestIndex = k
                }
            }
        }
        return [bestElement, bestIndex]
    }
}

/**
 * Returns a JavaScript array given a Java array.
 */
function convertJavaArray(ja) {
	var a = []
	for (var i = 0; i < js.length; i++) {
		a.push(ja[i])
	}
	return a
}