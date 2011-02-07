
// from: http://snippets.dzone.com/posts/show/4349
function getXPath(node, path) {
        path = path || [];
        if(node.parentNode) {
          path = getXPath(node.parentNode, path);
        }

        if(node.previousSibling) {
          var count = 1;
          var sibling = node.previousSibling
          do {
            if(sibling.nodeType == 1 && sibling.nodeName == node.nodeName) {count++;}
            sibling = sibling.previousSibling;
          } while(sibling);
          if(count == 1) {count = null;}
        } else if(node.nextSibling) {
          var sibling = node.nextSibling;
          do {
            if(sibling.nodeType == 1 && sibling.nodeName == node.nodeName) {
              var count = 1;
              sibling = null;
            } else {
              var count = null;
              sibling = sibling.previousSibling;
            }
          } while(sibling);
        }

        if(node.nodeType == 1) {
          path.push(node.nodeName.toLowerCase() + (node.id ? "[@id='"+node.id+"']" : count > 0 ? "["+count+"]" : ''));
        }
        return path;
      };

function escapeURL(s) {
    return encodeURIComponent(s)
}

// from MonetDB JavaScript XRPC API
function serializeXML(xml) {
    try {
        var xmlSerializer = new window.XMLSerializer();
        return xmlSerializer.serializeToString(xml);
    } catch(e){
        try {
            return xml.xml;
        } catch(e){
            alert("Failed to create xmlSerializer or to serialize XML document:\n" + e);
        }
    }
}
xmlToString = serializeXML
XMLToString = serializeXML

// creates functions:
//      escapeXml
//      unescapeXml
(function () {
    escapeXml = function (s, escapeBraces) {
        s = s.replace(/&/g, "&amp;")
        s = s.replace(/</g, "&lt;").
            replace(/>/g, "&gt;").
            replace(/'/g, "&apos;").
            replace(/"/g, "&quot;")
        if (escapeBraces) {
            s = s.replace(/{/g, '{{').replace(/}/g, '}}')
        }
        return s;
    }
    unescapeXml = function (s) {
        s = s.replace(/&lt;/g, "<").
            replace(/&gt;/g, ">").
            replace(/&apos;/g, "'").
            replace(/&quot;/g, '"')
        s = s.replace(/&amp;/g, "&")
        return s
    }
    escapeXML = escapeXml
    escapeXPath = escapeXml
    escapeXQuery = escapeXml
    unescapeXML = unescapeXml
})()

function xpath(s, n) {
  if (!n) n = document
  var doc = n.ownerDocument
  if (!doc) doc = document
  var x = doc.evaluate(s, n, null, 0, null)
  var a = []
  while (true) {
    var b = x.iterateNext()
    if (!b) break
    a.push(b)
  }
  return a
}

function getXMLHttpRequest() {
    if (window.XMLHttpRequest) { 
        return new XMLHttpRequest()
    } else if (window.ActiveXObject) {
        return new ActiveXObject("Microsoft.XMLHTTP")
    }
    return null
}

function my_ajax(url, postParams, callback) {
    var async = (callback != null)
    var x = getXMLHttpRequest()
    
    function getReturnValue() {
        return x.responseText
        //return x.responseXML ? x.responseXML : x.responseText
    }
    x.onreadystatechange = function() {
        if (x.readyState == 4 && x.status == 200) {
            if (async)
                callback(getReturnValue())
        }
    }
    if (postParams) {
        var paramString = ""
        if ((typeof postParams) == "string") {
            paramString = postParams
        } else {
            paramString = []
            for (var k in postParams) {
                paramString.push(escapeURL(k) + "=" + escapeURL(postParams[k]))
            }
            paramString = paramString.join("&")        
        }
        
        x.open("POST", url, async)
        x.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        x.setRequestHeader("Content-length", paramString.length);
        x.setRequestHeader("Connection", "close");
        x.send(paramString)
    } else {
        x.open("GET", url, async)
        x.send("")
    }
    if (!async) {
        return getReturnValue()
    }
}

// from: http://www.netlobo.com/url_query_string_javascript.html
function getURLParam(name) {
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return "";
  else
    return results[1];
}

parseXml_DOMParser = null
function parseXml(s) {
    if (!parseXml_DOMParser) {
        parseXml_DOMParser = new DOMParser()
    }
    return parseXml_DOMParser.parseFromString(s, "text/xml")
}
parseXML = parseXml

// these position function I got from somewhere, can't remember (found when looking for drag-n-drop stuff
function getPosition(e){
	var left = 0;
	var top  = 0;

	while (e.offsetParent){
		left += e.offsetLeft;
		top  += e.offsetTop;
		e     = e.offsetParent;
	}

	left += e.offsetLeft;
	top  += e.offsetTop;

	return {x:left, y:top};
}
function getPositionWithRespectTo(e, p){
    var ePos = getPosition(e)
    var pPos = getPosition(p)
    return {x: (ePos.x - pPos.x), y: (ePos.y - pPos.y)}
}

function distSq(a, b) {
    var dx = a.x - b.x
    var dy = a.y - b.y
    return (dx * dx) + (dy * dy)
}

function dist(a, b) {
    return Math.sqrt(distSq(a, b))
}

function lerp(t0, v0, t1, v1, t) {
    return (t - t0) * (v1 - v0) / (t1 - t0) + v0
}

function indexOf(array, element) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] == element) return i;
    }
    return -1
}

String.prototype.trim = function() {
	return this.replace(/^\s+|\s+$/g,"");
}

function scrollToHorzCenterIn(thing, scrollParent) {
    var offsetParent = scrollParent.firstChild
    var pos = getPositionWithRespectTo(thing, offsetParent)
    var x = pos.x
    var w = thing.offsetWidth
    var mw = offsetParent.offsetWidth
    var v = scrollParent.offsetWidth
    
    scrollParent.scrollLeft = (x + (w / 2)) - (v / 2)
}

// from: http://lists.evolt.org/pipermail/javascript/2004-June/007409.html
function addCommas(someNum){
    while (someNum.match(/^\d\d{3}/)){
        someNum = someNum.replace(/(\d)(\d{3}(\.|,|$))/, '$1,$2');
    }
    return someNum;
}
         
/**
*
*  Javascript sprintf
*  http://www.webtoolkit.info/
*
*
**/
sprintfWrapper = {

    init : function () {

        if (typeof arguments == "undefined") { return null; }
        if (arguments.length < 1) { return null; }
        if (typeof arguments[0] != "string") { return null; }
        if (typeof RegExp == "undefined") { return null; }

        var string = arguments[0];
        var exp = new RegExp(/(%([%]|(\-)?(\+|\x20)?(0)?(\d+)?(\.(\d)?)?([bcdfosxX])))/g);
        var matches = new Array();
        var strings = new Array();
        var convCount = 0;
        var stringPosStart = 0;
        var stringPosEnd = 0;
        var matchPosEnd = 0;
        var newString = '';
        var match = null;

        while (match = exp.exec(string)) {
            if (match[9]) { convCount += 1; }

            stringPosStart = matchPosEnd;
            stringPosEnd = exp.lastIndex - match[0].length;
            strings[strings.length] = string.substring(stringPosStart, stringPosEnd);

            matchPosEnd = exp.lastIndex;
            matches[matches.length] = {
                match: match[0],
                left: match[3] ? true : false,
                sign: match[4] || '',
                pad: match[5] || ' ',
                min: match[6] || 0,
                precision: match[8],
                code: match[9] || '%',
                negative: parseInt(arguments[convCount]) < 0 ? true : false,
                argument: String(arguments[convCount])
            };
        }
        strings[strings.length] = string.substring(matchPosEnd);

        if (matches.length == 0) { return string; }
        if ((arguments.length - 1) < convCount) { return null; }

        var code = null;
        var match = null;
        var i = null;

        for (i=0; i<matches.length; i++) {

            if (matches[i].code == '%') { substitution = '%' }
            else if (matches[i].code == 'b') {
                matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(2));
                substitution = sprintfWrapper.convert(matches[i], true);
            }
            else if (matches[i].code == 'c') {
                matches[i].argument = String(String.fromCharCode(parseInt(Math.abs(parseInt(matches[i].argument)))));
                substitution = sprintfWrapper.convert(matches[i], true);
            }
            else if (matches[i].code == 'd') {
                matches[i].argument = String(Math.abs(parseInt(matches[i].argument)));
                substitution = sprintfWrapper.convert(matches[i]);
            }
            else if (matches[i].code == 'f') {
                matches[i].argument = String(Math.abs(parseFloat(matches[i].argument)).toFixed(matches[i].precision ? matches[i].precision : 6));
                substitution = sprintfWrapper.convert(matches[i]);
            }
            else if (matches[i].code == 'o') {
                matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(8));
                substitution = sprintfWrapper.convert(matches[i]);
            }
            else if (matches[i].code == 's') {
                matches[i].argument = matches[i].argument.substring(0, matches[i].precision ? matches[i].precision : matches[i].argument.length)
                substitution = sprintfWrapper.convert(matches[i], true);
            }
            else if (matches[i].code == 'x') {
                matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(16));
                substitution = sprintfWrapper.convert(matches[i]);
            }
            else if (matches[i].code == 'X') {
                matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(16));
                substitution = sprintfWrapper.convert(matches[i]).toUpperCase();
            }
            else {
                substitution = matches[i].match;
            }

            newString += strings[i];
            newString += substitution;

        }
        newString += strings[i];

        return newString;

    },

    convert : function(match, nosign){
        if (nosign) {
            match.sign = '';
        } else {
            match.sign = match.negative ? '-' : match.sign;
        }
        var l = match.min - match.argument.length + 1 - match.sign.length;
        var pad = new Array(l < 0 ? 0 : l).join(match.pad);
        if (!match.left) {
            if (match.pad == "0" || nosign) {
                return match.sign + pad + match.argument;
            } else {
                return pad + match.sign + match.argument;
            }
        } else {
            if (match.pad == "0" || nosign) {
                return match.sign + match.argument + pad.replace(/0/g, ' ');
            } else {
                return match.sign + match.argument + pad;
            }
        }
    }
}
sprintf = sprintfWrapper.init;
