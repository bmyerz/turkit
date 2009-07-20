
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
