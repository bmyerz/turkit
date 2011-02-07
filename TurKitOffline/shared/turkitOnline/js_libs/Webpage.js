
/**
 * This module contains wrappers around webpageBase functions using once.
 * You probably want this, so that your webpages are only created once,
 * even though your script will probably crash and rerun many times.
 */
webpage = {}

/**
 Wraps {@link webpageBase.create} in a call to {@link once}.
 
 You can block one or more turkers from doing this HIT by passing them as a string or array to blockWorkers.
 */
webpage.create = function(contents, blockWorkers){
    return once(function(){
        var w = webpageBase.create(contents, blockWorkers)
		getCrashAndRerunFrame().url = __db.webpages[w].url
		return w
    }, "create webpage")
}

/**
 Wraps {@link webpageBase.remove} in a call to {@link once}.
 */
webpage.remove = function(url){
    return once(function(){
        return webpageBase.remove(url)
    }, "remove webpage")
}

/**
 Wraps {@link webpageBase.setData} in a call to {@link once}.
 */
webpage.setData = function(url, data){
    return once(function(){
        return webpageBase.setData(url, data)
    }, "setData on webpage")
}

/**
 If there is data available from the client, this data is returned and remembered
 in a call to {@link once}.
 If there is no data available, this method calls {@link crash}.
 */
webpage.waitForData = function(url){
    return once(function(){
        var data = webpageBase.getData(url)
        if (data == null) {
            print('\ncrashed - waiting for data from webpage: ' + url)
            crash()
        }
        return data
    }, "waitForData")
}


/**
 * Returns a webpage that can be used as a HIT.
 * The html passed to this function will be pasted into a DIV inside a template file.
 
 You can block one or more turkers from doing this HIT by passing them as a string or array to blockWorkers.
 */
webpage.createHITTemplate = function(html, blockWorkers) {
    return webpage.create(("" + __java.getHITTemplate()).replace(/___CONTENT___/, html), blockWorkers)
}
