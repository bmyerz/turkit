// unless otherwise stated (above a function definition)
// these functions were written by myself,
// and I release them into the public domain.
// ~Greg Little

function print(s) {
	Packages.java.lang.System.out["println(java.lang.Object)"](s)
}

function sleep(seconds) {
	Packages.java.lang.Thread.sleep(Math.floor(1000 * seconds))
}

function time() {
    return Packages.java.lang.System.currentTimeMillis()
}

function exit() {
	Packages.java.lang.System.exit(0)
}

json = function(o) {
	return "" + Packages.edu.mit.csail.uid.turkit.RhinoJson.json(o)
}

// adapted from "parse" function at http://json.org/json.js
function safeJson(s) {
	var safeJson_re = /(\s+|[\(\)\{\}\[\]=:,]|'(\\\'|[^'])*'|"(\\\"|[^"])*"|[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?|function|var|data|return|true|false|undefined|null|\/\*(\*+[^\*\/]|[^\*])*\*+\/)+/
	var m = s.match(safeJson_re)
	return m && (m[0] == s)
}

// ensure("db.pima.cards", {})
// ensure(null, "db.pima.cards", {})
// ensure(db, "pima.cards", {})
// ensure(db, ".pima.cards", {})
// ensure(db, ["pima", "cards"], {})
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

function values(obj) {
	var a = []
	foreach(obj, function(e) {
				a.push(e)
			})
	return a
}

function keys(obj) {
	var a = []
	foreach(obj, function(v, k) {
				a.push(k)
			})
	return a
}

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

Array.prototype.last = function() {
	return this[this.length - 1]
}

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

// add objB to objA
function merge(objA, objB) {
	foreach(objB, function(v, k) {
				objA[k] = v
			})
	return objA
}

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
