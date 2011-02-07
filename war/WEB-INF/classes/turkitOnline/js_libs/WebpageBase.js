
/**
 * This module contains functions for creating and communicating with webpages
 * that will be servered from the TurKit server.
 */
webpageBase = {}

/**
	Creates a publicly accessible webpage with the given contents.
	Returns the URL to the webpage.
 
 You can block one or more turkers from doing this HIT by passing them as a string or array to blockWorkers.
 */
webpageBase.create = function(contents, blockWorkers) {
    if (typeof blockWorkers != "string") blockWorkers = json(blockWorkers)
	var url = "" + __java.createPublicURL(contents, blockWorkers)
	ensure(__db, ['webpages', url], {url : url})
	verbosePrint("created webpage: " + url)
	return url
}

/**
	Removes the webpage at the specified URL.
 */
webpageBase.remove = function(url) {
	__java.deletePublicURL(url)
	delete __db.webpages[url]
	verbosePrint("deleted webpage: " + url) 
}

/**
	Webpages have a little bit of data associated with them
	allowing the server and client to communicate.
	This method sets that data.
 */
webpageBase.setData = function(url, data) {
	verbosePrint("setting webpage data")
	__java.setPublicURLData(url, data)
}

/**
	Webpages have a little bit of data associated with them
	allowing the server and client to communicate.
	This method gets that data, if and only if it was most recently written by the client.
	Returns null if the data was most recently written by the server.
 */
webpageBase.getData = function(url) {
	verbosePrint("getting webpage data")
	return __java.getPublicURLData(url)
}
