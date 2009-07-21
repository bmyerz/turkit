
var verbose = javaTurKit.verbose

/**
 * This function prints <i>s</i> if and only if TurKit is in "verbose" mode.
 */
function verbosePrint(s) {
	if (verbose) {
		print(s)
	}
}

/**
 * This is a reference to the TurKit object in Java running this JavaScript
 * file.
 */
var javaTurKit = javaTurKit

/**
	This is the directory that the currently running TurKit JavaScript file is in.
 */
var baseDir = javaTurKit.jsFile.getParent()

/**
	Get a Java File object given a path relative to the {@link baseDir}.
 */
function getFile(relPath) {
	var f = new Packages.java.io.File(baseDir, relPath)
	try {
		f.getCanonicalPath()
		return f
	} catch (e) {
		// maybe it's an absolute path after all?
		return new Packages.java.io.File(relPath)
	}	
}
