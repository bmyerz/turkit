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

// /////////////////////////////////////////////////////////////////////
// Database

/**
 * You probably want to use the global variable <code>database</code>.
 * 
 * @class Each TurKit script file has a JavaScript database associated with it.
 *        This JavaScriptDatabase instance is called <code>database</code>.
 * 
 * <p>
 * You may think of a JavaScript Database as a JavaScript environment that is
 * persisted on disk. Any query you make to the
 * database is evaluated in the context of the database, the new state of the database
 * is written to disk, and then the result is returned.
 */
function Database() {
	this.database = javaTurKit.database
}

/**
 * A reference to the Java JavaScriptDatabase object associated with this TurKit
 * file.
 */
Database.prototype.database = null

/**
 * Evaluates <i>s</i> in the context of the JavaScript database, and returns a
 * deep clone of the result. Note that this function evaluates the string of
 * JSON returned from the JavaScript database, and returns the result.
 */
Database.prototype.query = function(s) {
	return eval("" + this.database.query(s))
}

/**
 * This is a reference to the {@link Database} associated with this TurKit file.
 */
var database = new Database()

// /////////////////////////////////////////////////////////////////////
// Trace API

/**
 * You probably want to just use the global variable <code>traceManager</code>.
 * 
 * @class The TraceManager manages a sort of stack frame that is memoized on
 *        disk (using the JavaScript database associated with the current file).
 *        All stack frames are memoized, so the result is a sort of stack tree.
 * 
 * <p>
 * <code>traceManager</code> is a global instance of this class.
 * </p>
 */
function TraceManager() {
	this.stackFramePath = ["__stackFrames",
			javaTurKit.sandbox ? "sandbox" : "for-real"]
	this.stackIndexes = [0]
	this.visitedStackFrames = {}
	this.beforePushFrame = true
}

/**
 * Pushes a new stack frame onto the memoized stack.
 */
TraceManager.prototype.pushFrame = function(frameName) {
	this.beforePushFrame = false
	if (frameName) {
		this.stackFramePath.push("namedFrames")
		this.stackFramePath.push(frameName)
	} else {
		this.stackFramePath.push("sequencialFrames")
		this.stackFramePath
				.push(this.stackIndexes[this.stackIndexes.length - 1]++)
	}
	this.stackIndexes.push(0)

	var path = json(this.stackFramePath)

	// make sure we haven't already been here
	if (this.visitedStackFrames[path]) {
		throw "visiting the same stack frame twice: " + path
	}
	this.visitedStackFrames[path] = true

	return database.query("return prune(ensure(null, " + path + ", " + json({
				creationTime : time()
			}) + "))")
}

/**
 * Sets the value of a "local variable" in the current memoized stack frame.
 * This value is persisted in the memoized stack.
 */
TraceManager.prototype.setFrameValue = function(name, value) {
	database.query("ensure(null, " + json(this.stackFramePath.concat(["values"]))
			+ ")[" + json(name) + "] = " + json(value))
}

/**
 * Gets the value of a "local variable" in the current memoized stack frame.
 */
TraceManager.prototype.getFrameValue = function(name) {
	database.query("return ensure(null, "
			+ json(this.stackFramePath.concat(["values"])) + ")[" + json(name)
			+ "]")
}

/**
 * Pops the top stack frame off of the memoized stack. Note that this does not
 * remove anything from the memoized stack. The memoized stack is a tree which
 * stores a trace of every stack frame that ever went onto the stack.
 */
TraceManager.prototype.popFrame = function() {
	this.stackFramePath.pop()
	this.stackFramePath.pop()
	this.stackIndexes.pop()
}

/**
 * Calls the function <i>func</i> only once; subsequent runs of the program
 * will not call <i>func</i> if it returns successfully this time. If <i>func</i>
 * throws an exception, then it will be called again when the program is
 * re-executed.
 * 
 * <p>
 * This function creates a new memoized stack frame before calling <i>func</i>.
 * You can give this stack frame a name as an optional second parameter
 * <i>frameName</i>.
 * </p>
 */
TraceManager.prototype.once = function(func, frameName) {
	var frame = this.pushFrame(frameName)
	try {
		if ("returnValue" in frame) {
			frame.returnValue = database.query("return ensure(null, "
					+ json(this.stackFramePath) + ").returnValue")
		}

		else {
			frame = {
				returnValue : func(),
				returnTime : time()
			}
			database.query("merge(ensure(null, " + json(this.stackFramePath)
					+ "), " + json(frame) + ")")
		}
	} finally {
		this.popFrame()
	}
	return frame.returnValue
}

/**
 * This is a wrapper around {@link TraceManager#once}.
 */
function once(func, frameName) {
	return traceManager.once(func, frameName)
}

/**
 * Calls the function <i>func</i> in a new memoized stack frame, and catches
 * the "stop" exception. Returns <code>true</code> if the call succeeds.
 * Returns <code>false</code> if <i>func</i> throws a "stop" exception (see
 * {@link TraceManager#stop}).
 */
TraceManager.prototype.attempt = function(func, frameName) {
	this.pushFrame(frameName)
	try {
		func()
	} catch (e) {
		if ("" + e == "stop") {
			return false
		} else {
			throw e
		}
	} finally {
		this.popFrame()
	}
	return true
}

/**
 * This is a wrapper around {@link TraceManager#attempt}.
 */
function attempt(func, frameName) {
	return traceManager.attempt(func, frameName)
}

/**
 * Sets the root of the memoized stack frame tree. Calling this method with a
 * new value for <i>traceName</i> has the effect of reseting all calls to
 * {@link TraceManager#once}, so that they re-execute their functions.
 */
TraceManager.prototype.setTrace = function(traceName) {
	if (!this.beforePushFrame) {
		throw "you may not call setTrace from within a once or attempt, or after pushing a frame"
	}
	if (!traceName) {
		throw "you must provide an identifier or version number of some sort"
	}
	this.stackFramePath[1] = (javaTurKit.sandbox ? "sandbox" : "for-real")
			+ ":" + traceName
}

/**
 * Wrapper around {@link TraceManager#setTrace}
 */
function setTrace(traceName) {
	return traceManager.setTrace(traceName)
}

/**
 * Similar to {@link TraceManager#setTrace}, except that it clears the memoized
 * stack frame data for all other trace versions.
 */
TraceManager.prototype.resetTrace = function(traceName) {
	if (!this.beforePushFrame) {
		throw "you may not call resetTrace from within a once or attempt, or after pushing a frame"
	}
	if (!traceName) {
		throw "you must provide an identifier or version number of some sort"
	}
	this.stackFramePath[1] = (javaTurKit.sandbox ? "sandbox" : "for-real")
			+ ":" + traceName
	database.query("var a = " + this.stackFramePath[0]
			+ "; foreach(a, function (v, k) {if (k != "
			+ json(this.stackFramePath[1]) + ") {delete a[k]}})")
}

/**
 * Wrapper around {@link TraceManager#resetTrace}.
 */
function resetTrace(traceName) {
	return traceManager.resetTrace(traceName)
}

/**
 * Throws a "stop" exception. This is the preferred way of stopping execution in
 * order to wait on HITs on Mechanical Turk. Note that the "stop" exception is
 * caught by {@link TraceManager#attempt}.
 */
TraceManager.prototype.stop = function() {
	javaTurKit.stopped = true
	throw "stop"
}

/**
 * Wrapper around {@link TraceManager#stop}.
 */
function stop() {
	return traceManager.stop()
}

/**
 * This is a pointer to the {@link TraceManager}. You probably want to use
 * this, and not create another TraceManager.
 */
var traceManager = new TraceManager()

// /////////////////////////////////////////////////////////////////////
// MTurk Wrappers and Utilities

/**
 * You probably want to use the global variable <code>mturk</code>.
 * 
 * @class MTurk contains wrappers around the Java API for accessing Mechanical
 *        Turk.
 * 
 * <p>
 * <code>mturk</code> is a global instance of the MTurk class.
 * </p>
 */
function MTurk() {
	this.requesterService = javaTurKit.requesterService
}

/**
 * A reference to a Java RequesterService object from the Java MTurk API.
 */
MTurk.prototype.requesterService = null

/*
 * Throw an exception if we cannot spend the given amount of <i>money</i>, or
 * create the given number of <i>hits</i>, without violating our safety limits.
 * The <i>callbackBeforeCrash</i> will be called before an exception is thrown,
 * if an exception is about to be thrown.
 */
MTurk.prototype.assertWeCanSpend = function(money, hits, callbackBeforeCrash) {
	if (!javaTurKit.safety)
		return

	var safety = {
		moneySpent : 0,
		hitsCreated : 0
	}
	safety = database.query("return ensure('__safetyCounters', " + json(safety)
			+ ")")
	safety.moneySpent += money
	safety.hitsCreated += hits
	if (safety.moneySpent > javaTurKit.maxMoney) {
		if (callbackBeforeCrash)
			callbackBeforeCrash()
		throw "TurKit has detected a safety violation: spending too much money."
				+ "You need to increase your spending limit with TurKit (not with MTurk) to overcome this problem."
	}
	if (safety.hitsCreated > javaTurKit.maxHITs) {
		if (callbackBeforeCrash)
			callbackBeforeCrash()
		throw "TurKit has detected a safety violation: creating too many HITs."
				+ "You need to increase your hit limit with TurKit (not with MTurk) to overcome this problem."
	}
	safety = database.query("__safetyCounters = " + json(safety))
}

/**
 * Repeatedly tries to execute the given <i>func</i>, and returns the result
 * once it succeeds.
 */
MTurk.prototype.keepTrying = function(func) {
	sleep(0.05)
	var waitTime = 0.1
	for (var i = 0; i < 10; i++) {
		try {
			var ret = func()
			return ret
		} catch (e) {
			if (/throttled/.exec("" + e)) {
				verbosePrint("throttled")
				sleep(waitTime)
				waitTime += 0.1
			} else {
				throw e
			}
		}
	}
	// try one last time (this time don't catch the error)
	return func()
}

/**
 * Returns the number of dollars in the user's MTurk account.
 */
MTurk.prototype.getAccountBalance = function() {
	return this.keepTrying(function() {
				return mturk.requesterService.getAccountBalance()
			})
}

/**
 * Creates a HIT. <i>params</i> is an object with the following properties:
 * <ul>
 * <li><b>title</b>: displayed in the list of HITs on MTurk.</li>
 * <li><b>description</b>: <b>desc</b> is also accepted. A slightly longer
 * description of the HIT, also shown in the list of HITs on MTurk</li>
 * <li><b>question</b>: a string of XML specifying what will be shown. <a
 * href="http://docs.amazonwebservices.com/AWSMechanicalTurkRequester/2008-08-02/index.html?ApiReference_QuestionFormDataStructureArticle.html">See
 * documentation here</a>. Instead of <i>question</i>, you may use the following special parameters:
 <ul>
 <li><b>url</b>: creates an external question pointing to this URL</li>
 <li><b>height</b>: (optional) height of the iFrame embedded in MTurk, in pixels (default is 600).</li>
 </ul>
 
 </li>
 * <li><b>reward</b>: how many dollars you want to pay per assignment for this
 * HIT.
 * </ul>
 * The following properties are optional:
 * <ul>
 * <li><b>hitTypeId</b>: this may be given instead of the information above;
 * usually it is not known or needed.</li>
 * <li><b>keywords</b>: keywords to help people search for your HIT.</li>
 * <li><b>assignmentDurationInSeconds</b>: default is 1 hour's worth of
 * seconds.</li>
 * <li><b>autoApprovalDelayInSeconds</b>: default is 1 month's worth of
 * seconds.</li>
 * <li><b>lifetimeInSeconds</b>: default is 1 week's worth of seconds.</li>
 * <li><b>maxAssignments</b>: default is 1.</li>
 * <li><b>requesterAnnotation</b>: default is no annotation.</li>
 * <li><b>qualificationRequirements</b>: default is no requirements.</li>
 * <li><b>minApproval</b>: minimum approval percentage. The appropriate
 * requirement will be added if you supply a percentage here.</li>
 * <li><b>responseGroup</b>: default is no response group.</li>
 * </ul>
 */
MTurk.prototype.createHITRaw = function(params) {
	if (!params)
		params = {}

	if (params.HITTypeID)
		params.hitTypeId = params.HITTypeID
	if (params.hitTypeId) {
	} else {
		params.hitTypeId = null
		if (!params.title)
			throw "createHIT requires a title"

		if (params.desc)
			params.description = params.desc
		if (!params.description)
			throw "createHIT requires a description"

		if (!params.reward)
			throw "createHIT requires a reward"

		if (!params.assignmentDurationInSeconds)
			params.assignmentDurationInSeconds = 60 * 60 // one hour

		if (params.minApproval) {
			ensure(params, "qualificationRequirements", [])
					.push(new Packages.com.amazonaws.mturk.requester.QualificationRequirement(
							"000000000000000000L0",
							Packages.com.amazonaws.mturk.requester.Comparator.GreaterThanOrEqualTo,
							params.minApproval, null, false))
		}
	}

	if (params.html) {
		if (!params.bucket) {
			params.bucket = javaTurKit.awsAccessKeyID.toLowerCase() + "-turkit"
		}
		var s = ("" + javaTurKit.taskTemplate).replace(/\[\[\[CONTENT\]\]\]/, params.html)
		var key = Packages.edu.mit.csail.uid.turkit.util.U.md5(s) + ".html"
		params.url = s3.putString(params.bucket, key, s)
		
		if (params.blockWorkers) {
			if ((typeof params.blockWorkers) != "string") {
				params.blockWorkers = params.blockWorkers.join(",")
			}
			params.url += "?blockWorkers=" + params.blockWorkers
		}
	}
	
	if (params.url) {
		if (!params.height)
			params.height = 600

		params.question = '<ExternalQuestion xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd">'
				+ '<ExternalURL>'
				+ escapeXml(params.url)
				+ '</ExternalURL>'
				+ '<FrameHeight>'
				+ params.height
				+ '</FrameHeight>'
				+ '</ExternalQuestion>'
	}

	if (!params.question)
		throw "createHIT requires a question (or a url, or html)"

	if (!params.lifetimeInSeconds)
		params.lifetimeInSeconds = 60 * 60 * 24 * 7 // one week

	if (!params.maxAssignments)
		params.maxAssignments = 1

	if (!params.autoApprovalDelayInSeconds)
		params.autoApprovalDelayInSeconds = null

	if (javaTurKit.safety) {
		if (params.hitTypeId) {
			ensure(params, 'responseGroup', []).push('HITDetail')
		} else {
			this.assertWeCanSpend(params.reward * params.maxAssignments,
					params.maxAssignments)
		}
	}

	if (!params.requesterAnnotation)
		params.requesterAnnotation = null

	if (!params.responseGroup)
		params.responseGroup = null

	if (!params.qualificationRequirements)
		params.qualificationRequirements = null

	var hit = this.keepTrying(function() {
				return mturk.requesterService.createHIT(params.hitTypeId,
						params.title, params.description, params.keywords,
						params.question, params.reward,
						params.assignmentDurationInSeconds,
						params.autoApprovalDelayInSeconds,
						params.lifetimeInSeconds, params.maxAssignments,
						params.requesterAnnotation,
						params.qualificationRequirements, params.responseGroup);
			})

	if (javaTurKit.safety) {
		if (params.hitTypeId) {
			this.assertWeCanSpend(parseFloat(hit.getReward().getAmount())
							* params.maxAssignments, params.maxAssignments,
					function() {
						mturk.disableHITRaw(hit)
					})
		} else {
		}
	}

	var hitId = "" + hit.getHITId()
	verbosePrint("created HIT: " + hitId)
	var url = (javaTurKit.sandbox
					? "https://workersandbox.mturk.com/mturk/preview?groupId="
					: "https://www.mturk.com/mturk/preview?groupId=")
			+ hit.getHITTypeId()
	verbosePrint("        url: " + url)
	database.query("ensure(null, ['__HITs', " + json(hitId) + "], " + json({url : url}) + ")")
	return hitId
}

/**
 * Calls {@link MTurk#createHITRaw} inside of {@link TraceManager#once}.
 */
MTurk.prototype.createHIT = function(params) {
	return once(function() {
				return mturk.createHITRaw(params)
			})
}

/**
 * Returns a list of HIT Ids of HITs that are ready to be reviewed.
 */
MTurk.prototype.getReviewableHITs = function() {
	return convertJavaArray(this.keepTrying(function() {
				return mturk.requesterService.getAllReviewableHITs(null)
			}))
}

/**
 * Tries to determine the type of <code>hit</code> and return the HIT Id.
 */
MTurk.prototype.tryToGetHITId = function(hit) {
	if ((typeof hit) == "object") {
		try {
			if (hit.hitId) {
				return hit.hitId
			}
		} catch (e) {
		}
		try {
			return "" + hit.getHITId()
		} catch (e) {
		}
		return "" + hit
	}
	return hit
}

/**
 * Tries to determine the type of <code>assignment</code> and return the
 * assignment Id.
 */
MTurk.prototype.tryToGetAssignmentId = function(assignment) {
	if ((typeof assignment) == "object") {
		try {
			if (assignment.assignmentId) {
				return assignment.assignmentId
			}
		} catch (e) {
		}
		try {
			return "" + assignment.getAssignmentId()
		} catch (e) {
		}
		return "" + assignment
	}
	return assignment
}

/**
 * Returns an array of assignments for the given <code>hit</code>.
 */
MTurk.prototype.getAssignmentsForHIT = function(hit) {
	var hitId = this.tryToGetHITId(hit)
	return convertJavaArray(this.keepTrying(function() {
				return mturk.requesterService.getAllAssignmentsForHIT(hitId)
			}))
}

/**
 * Extends the <code>hit</code> by the given number of assignments (<code>moreAssignments</code>),
 * and the given number of seconds (<code>moreSeconds</code>).
 */
MTurk.prototype.extendHITRaw = function(hit, moreAssignments, moreSeconds) {
	if (javaTurKit.safety) {
		if (moreAssignments != null) {
			if ((typeof hit == "object") && ("reward" in hit)) {
			} else {
				hit = this.getHIT(hit)
			}
			this.assertWeCanSpend(parseFloat(hit.reward) * moreAssignments,
					moreAssignments)
		}
	}

	var hitId = this.tryToGetHITId(hit)
	this.keepTrying(function() {
				mturk.requesterService.extendHIT(hitId, moreAssignments,
						moreSeconds)
			})
	verbosePrint("extended HIT: " + hitId)
}

/**
 * Calls {@link MTurk#extendHITRaw} inside of {@link TraceManager#once}.
 */
MTurk.prototype.extendHIT = function(hit, moreAssignments, moreSeconds) {
	return once(function() {
				return mturk.extendHITRaw(hit, moreAssignments, moreSeconds)
			})
}

/**
	Deletes the given <code>hit</code>.
	If there are any completed assignments that have not been approved or rejected, then they are approved.
 */
MTurk.prototype.deleteHITRaw = function(hit) {
	var hitId = this.tryToGetHITId(hit)
	
	// first, try to disable the HIT
	try {
		this.keepTrying(function() {
			mturk.requesterService.disableHIT(hitId)
		})
		verbosePrint("disabled HIT: " + hitId)
	} catch (e) {
		try {	
			// check to see if we have already deleted it
			hit = this.getHIT(hitId)
			if (hit.hitStatus == "Disposed") {
				verbosePrint("already deleted HIT: " + hitId)
			} else {
				// ok, it must be "Reviewable"
				// (since we couldn't disable it, and it isn't already deleted)
				
				// first, approve all the assignments
				foreach(hit.assignments, function (a) {
					mturk.approveAssignmentRaw(a)
				})
				
				// next, dispose of the HIT
				this.keepTrying(function() {
					mturk.requesterService.disposeHIT(hitId)
				})
				verbosePrint("disposed HIT: " + hitId)
			}
		} catch (e) {
			if (/AWS\.MechanicalTurk\.HITDoesNotExist/.exec("" + e)) {
				verbosePrint("HIT not found: " + hitId)
			} else {
				throw e
			}
		}
	}
	
	database.query("delete __HITs[" + json(hitId) + "]")
}

/**
 * Calls {@link MTurk#deleteHITRaw} inside of {@link TraceManager#once}.
 */
MTurk.prototype.deleteHIT = function(hit) {
	once(function() {
				mturk.deleteHITRaw(hit)
			})
}

/**
 * Calls {@link MTurk#deleteHITRaw} on the array of <code>hits</code>.
 */
MTurk.prototype.deleteHITsRaw = function(hits) {
	if (!(hits instanceof Array)) {
		hits = [hits]
	}
	foreach(hits, function (hit) {
		mturk.deleteHITRaw(hit)
	})
}

/**
 * Calls {@link MTurk#deleteHITsRaw} inside of {@link TraceManager#once}.
 */
MTurk.prototype.deleteHITs = function(hits) {
	once(function() {
				mturk.deleteHITsRaw(hits)
			})
}

/**
 * Grants a bonus of the given <code>amount</code> to the given
 * <code>assignment</code> for the stated <code>reason</code>.
 */
MTurk.prototype.grantBonusRaw = function(assignment, amount, reason) {
	this.keepTrying(function() {
				mturk.requesterService.grantBonus(assignment.workerId, amount,
						assignment.assignmentId, reason)
			})
	verbosePrint("granted bonus of " + amount + " for assignment "
			+ assignment.assignmentId)
}

/**
 * Calls {@link MTurk#grantBonusRaw} inside of {@link TraceManager#once}.
 */
MTurk.prototype.grantBonus = function(assignment, amount, reason) {
	return once(function() {
				return mturk.grantBonusRaw(assignment, amount, reason)
			})
}

/**
 * Approves the given <code>assignment</code>, and provides an optional
 * <code>reason</code>.
 */
MTurk.prototype.approveAssignmentRaw = function(assignment, reason) {
	assignmentId = this.tryToGetAssignmentId(assignment)
	this.keepTrying(function() {
				mturk.requesterService.approveAssignment(assignmentId, reason)
			})
	verbosePrint("approved assignment " + assignment.assignmentId)
}

/**
 * Calls {@link MTurk#approveAssignmentRaw} inside of {@link TraceManager#once}.
 */
MTurk.prototype.approveAssignment = function(assignment, reason) {
	return once(function() {
				return mturk.approveAssignmentRaw(assignment, reason)
			})
}

/**
 * Calls {@link MTurk#approveAssignment} for each assignment in the given
 * <code>assignments</code> array.
 */
MTurk.prototype.approveAssignments = function(assignments, reason) {
	foreach(assignments, function(assignment) {
				mturk.approveAssignment(assignment, reason)
			})
}

/**
 * Rejects the given <code>assignment</code>, and provides an optional
 * <code>reason</code>.
 */
MTurk.prototype.rejectAssignmentRaw = function(assignment, reason) {
	assignmentId = this.tryToGetAssignmentId(assignment)
	this.keepTrying(function() {
				mturk.requesterService.rejectAssignment(assignmentId, reason)
			})
	verbosePrint("rejected assignment " + assignment.assignmentId)
}

/**
 * Calls {@link MTurk#rejectAssignmentRaw} inside of {@link TraceManager#once}.
 */
MTurk.prototype.rejectAssignment = function(assignment, reason) {
	return once(function() {
				return mturk.rejectAssignmentRaw(assignment, reason)
			})
}

/**
 * Calls {@link MTurk#rejectAssignment} for each assignment in the given
 * <code>assignments</code> array.
 */
MTurk.prototype.rejectAssignments = function(assignments, reason) {
	foreach(assignments, function(assignment) {
				mturk.rejectAssignment(assignment, reason)
			})
}

/**
 * Returns an array of HIT Ids for all the HITs you currently have on MTurk.
 */
MTurk.prototype.getHITs = function() {
	return convertJavaArray(this.keepTrying(function() {
				return mturk.requesterService.searchAllHITs()
			}))
}

/**
 * Returns an object representing all of the information MTurk has on the given
 * HIT, including the assigments, and the associated answer data. The returned
 * object will have a value called <i>done</i> set to true iff all the pending
 * assigments for this HIT have been completed.
 * 
 * <p>
 * Note that the <i>answer</i> data structure associated with each assigment is
 * simplified. It is recommended that you print out the result of this function
 * using {@link json}, in order to know what it looks like for your specific
 * situation.
 * </p>
 */
MTurk.prototype.getHIT = function(hit) {
	var hitId = this.tryToGetHITId(hit)
	var hit = this.keepTrying(function() {
				return mturk.requesterService.getHIT(hitId)
			})
	var hit = {
		hitId : "" + hit.getHITId(),
		hitTypeId : "" + hit.getHITTypeId(),
		title : "" + hit.getTitle(),
		description : "" + hit.getDescription(),
		keywords : "" + hit.getKeywords(),
		reward : "" + hit.getReward().getAmount(),
		question : hit.getQuestion(),
		maxAssignments : "" + hit.getMaxAssignments(),
		assignmentDurationInSeconds : hit.getAssignmentDurationInSeconds(),
		autoApprovalDelayInSeconds : hit.getAutoApprovalDelayInSeconds(),
		requesterAnnotation : hit.getRequesterAnnotation(),
		hitStatus : "" + hit.getHITStatus(),
		hitReviewStatus : "" + hit.getHITReviewStatus(),
		creationTime : hit.getCreationTime().getTimeInMillis(),
		expiration : hit.getExpiration().getTimeInMillis(),
		assignments : []
	}
	foreach(this.getAssignmentsForHIT(hitId), function(javaAssignment) {
				function getTime(t) {
					if (t != null)
						return t.getTimeInMillis()
				}
				var assignment = {
					assignmentId : "" + javaAssignment.getAssignmentId(),
					hitId : "" + javaAssignment.getHITId(),
					assignmentStatus : ""
							+ javaAssignment.getAssignmentStatus(),
					requesterFeedback : ""
							+ javaAssignment.getRequesterFeedback(),
					workerId : "" + javaAssignment.getWorkerId(),
					acceptTime : getTime(javaAssignment.getAcceptTime()),
					approvalTime : getTime(javaAssignment.getApprovalTime()),
					autoApprovalTime : getTime(javaAssignment
							.getAutoApprovalTime()),
					deadline : getTime(javaAssignment.getDeadline()),
					rejectionTime : getTime(javaAssignment.getRejectionTime()),
					submitTime : getTime(javaAssignment.getSubmitTime())
				}

				// deal with answers
				// NOTE: we use the name "answer" to refer to the set of
				// answers, because that is how Mechanical Turk refers to them
				// in the
				// Assignment data structure
				assignment.answer = {}
				var answers = mturk.requesterService.parseAnswers(javaAssignment
						.getAnswer()).getAnswer()
				for (var ai = 0; ai < answers.size(); ai++) {
					var a = answers.get(ai)

					var rhs = a.getFreeText()
					if (rhs) {
						rhs = "" + rhs
					}
					if (!rhs) {
						rhs = a.getUploadedFileKey()
						if (rhs) {
							rhs = {
								uploadedFileKey : "" + rhs,
								uploadedFileSizeInBytes : a
										.getUploadedFileSizeInBytes()
							}
						}
					}
					if (!rhs) {
						rhs = []
						var sels = a.getSelectionIdentifier()
						for (var si = 0; si < sels.size(); si++) {
							rhs.push("" + sels.get(si))
						}
						var o = a.getOtherSelectionText()
						if (o) {
							rhs.push("" + o)
						}
					}

					assignment.answer["" + a.getQuestionIdentifier()] = rhs
				}

				hit.assignments.push(assignment)
			})
	hit.done = (hit.hitStatus == "Reviewable")
			&& (hit.assignments.length == hit.maxAssignments)
	return hit
}

/**
 * Returns information about the <code>hit</code> if it is done (see
 * {@link MTurk#getHIT}), and throwing the "stop" exception if it is still in
 * progress.
 */
MTurk.prototype.waitForHIT = function(hit) {
	var hitId = this.tryToGetHITId(hit)
	return once(function() {
				var hit = mturk.getHIT(hitId);
				if (!hit.done) {
					stop()
				};
				verbosePrint("hit completed: " + hitId)
				return hit
			})
}

// /////////////////////////////////////////////////////////////////////
// MTurk High-level Utilities

/**
 * Collects multiple votes until a minimum number of necessary votes for a
 * single choice is achieved. The <code>hit</code> supplied to this function
 * must have its <i>maxAssignments</i> set to the minimum number of votes
 * necessary for a single choice. This function will add assignments if
 * necessary. This function relies on <code>extractVoteFromAnswer</code> to
 * extract a String representing the choice given an answer data structure (see
 * {@link MTurk#getHIT}).
 * 
 * <p>
 * The return value is an object with the following entries:
 * </p>
 * <ul>
 * <li><b>bestOption</b>: the String representing the choice with the most
 * votes.</li>
 * <li><b>totalVoteCount</b>: the number of votes received from turkers.</li>
 * <li><b>voteCounts</b>: an object with key/value pairs representing
 * choice/voteCounts.</li>
 * </ul>
 */
MTurk.prototype.vote = function(hit, extractVoteFromAnswer) {
	var necessaryVoteCount = null
	var hitId = this.tryToGetHITId(hit)
	while (true) {
		var hit = this.waitForHIT(hitId)

		if (necessaryVoteCount == null) {
			necessaryVoteCount = hit.maxAssignments
		}

		var votes = {}
		foreach(hit.assignments, function(assignment) {
					var vote = extractVoteFromAnswer(assignment.answer)
					votes[vote] = ensure(votes, [vote], 0) + 1
				})
		var winnerVotes, winner
		[winnerVotes, winner] = getMax(votes)

		if (winnerVotes >= necessaryVoteCount) {
			foreach(hit.assignments, function(assignment) {
						mturk.approveAssignment(assignment)
					})
			this.deleteHIT(hit)
			return {
				bestOption : winner,
				totalVoteCount : hit.assignments.length,
				voteCounts : votes
			}
		} else {
			this.extendHIT(hit, necessaryVoteCount - winnerVotes, null)
		}
	}
}

/**
 * Works just like the JavaScript array sort function, except that this one can
 * perform comparisons in parallel on MTurk by catching the "stop" exception
 * which is thrown when waiting on an MTurk HIT using {@link MTurk#waitForHIT}.
 */
MTurk.prototype.sort = function(a, comparator) {
	traceManager.pushFrame()
	try {
		var sortTree = traceManager.getFrameValue("sortTree")
		if (!sortTree)
			sortTree = {}

		function insertIntoTree(index, tree) {
			if (tree.index == null) {
				tree.index = index
				return
			}
			var comp = comparator(a[index], a[tree.index])
			if (comp == 0) {
			} else if (comp < 0) {
				insertIntoTree(index, ensure(tree, ["left"], {}))
			} else {
				insertIntoTree(index, ensure(tree, ["right"], {}))
			}
		}
		var done = true
		foreach(a, function(e, i) {
					if (attempt(function() {
								insertIntoTree(i, sortTree)
							})) {
						traceManager.setFrameValue("sortTree", sortTree)
					} else {
						done = false
					}
				})
		if (!done)
			stop()

		var newA = []
		function traverseTree(tree) {
			if (!tree)
				return
			traverseTree(tree.left)
			newA.push(a[tree.index])
			traverseTree(tree.right)
		}
		traverseTree(sortTree)
		return newA
	} finally {
		traceManager.popFrame()
	}
}

/**
 * A reference to an {@link MTurk} object.
 * 
 * @return {MTurk}
 */
mturk = new MTurk()

// /////////////////////////////////////////////////////////////////////
// JetS3t Wrappers and Utilities

/**
 * You probably want to use the global variable <code>s3</code>.
 * 
 * @class S3 contains wrappers around the JetS3t API for accessing Amazon's S3 storage service.
 * 
 * <p>
 * <code>s3</code> is a global instance of the S3 class.
 * </p>
 */
function S3() {
	this.s3Service = javaTurKit.s3Service
}

/**
 * A reference to an S3Service object in the JetS3t API.
 */
S3.prototype.s3Service = null

/**
	Add public permissions to the given S3Object, and upload it to S3.
	This function will create the bucket if it doesn't exist.
	Returns the URL for the object.
 */
S3.prototype.putObjectRaw = function(bucketName, s3Object) {
	var bucket = this.s3Service.getOrCreateBucket(bucketName)
	var acl = this.s3Service.getBucketAcl(bucket)
	acl.grantPermission(org.jets3t.service.acl.GroupGrantee.ALL_USERS,
		org.jets3t.service.acl.Permission.PERMISSION_READ)
	s3Object.setAcl(acl)
	this.s3Service.putObject(bucket, s3Object);
	var url = this.getURL(bucket, s3Object)
	database.query("ensure(null, ['__S3_Objects', " + json(url) + "], " + json({}) + ")")
	if (verbose) {
		print("S3 object put at: " + url)
	}
	return url
}

/**
 * Calls {@link S3#putObjectRaw} inside of {@link TraceManager#once}.
 */
S3.prototype.putObject = function(bucketName, s3Object) {
	return once(function() {
				return s3.putObjectRaw(bucketName, s3Object)
			})
}

/**
	Creates an S3 URL given a <code>bucket</code> and a <code>key</code>.
 */
S3.prototype.getURL = function(bucket, key) {
	if ((typeof bucket) == "object") {
		bucket = bucket.getName()
	}
	if ((typeof key) == "object") {
		key = key.getKey()
	}
	return "http://s3.amazonaws.com/" + bucket + "/" + key
}

/**
	Extracts the bucket name and key from an S3 URL. For instance, given <code>http://s3.amazonaws.com/hello/hi.txt</code>,
	returns <code>{bucket:"hello", key:"hi.txt"}</code>.
 */
S3.prototype.getBucketAndKey = function(url) {
    var a = url.match(/http:\/\/s3\.amazonaws\.com\/([^\/]+)\/(.*)/)
    if (!a) {
        a = url.match(/http:\/\/([^\/]+)\.s3\.amazonaws\.com\/(.*)/)
        if (!a) return
    }
    return {bucket : a[1], key : a[2]}
}

/**
	Remove the object with the given <code>key</code> from the bucket with the given <code>bucketName</code>.
	If only one parameter is supplied, it assumes it is an S3 URL, and attempts to extract the bucket name and key from that.
 */
S3.prototype.deleteObjectRaw = function(bucketName, key) {
	if (!key) {
		var a = this.getBucketAndKey(bucketName)
		bucketName = a.bucket
		key = a.key
	}
	this.s3Service.deleteObject(bucketName, key)
	
	var url = this.getURL(bucketName, key)
	verbosePrint("deleted S3 object at: " + url)
	database.query("delete __S3_Objects[" + json(url) + "]")	
}

/**
 * Calls {@link S3#deleteObjectRaw} inside of {@link TraceManager#once}.
 */
S3.prototype.deleteObject = function(bucketName, key) {
	return once(function() {
				return s3.deleteObjectRaw(bucketName, key)
			})
}

/**
	Create a public object in S3 based on a string.
	Returns the URL for the object.
 */
S3.prototype.putStringRaw = function(bucketName, key, stringData) {
	var o = new Packages.org.jets3t.service.model.S3Object(key, stringData)
	if (key.match(/\.html$/)) {
		o.setContentType("text/html")
	}
	return this.putObjectRaw(bucketName, o)
}

/**
 * Calls {@link S3#putStringRaw} inside of {@link TraceManager#once}.
 */
S3.prototype.putString = function(bucketName, key, stringData) {
	return once(function() {
				return s3.putStringRaw(bucketName, key, stringData)
			})
}

/**
	Create a public object in S3 based on a file.
	Returns the URL for the object.
 */
S3.prototype.putFileRaw = function(bucketName, file) {
	if ((typeof file) == "string") {
		file = new java.io.File(file)
	}
	return this.putObjectRaw(bucketName, new Packages.org.jets3t.service.model.S3Object(file))
}

/**
 * Calls {@link S3#putFileRaw} inside of {@link TraceManager#once}.
 */
S3.prototype.putFile = function(bucketName, file) {
	return once(function() {
				return s3.putFileRaw(bucketName, file)
			})
}

/**
 * A reference to an {@link S3} object.
 * 
 * @return {S3}
 */
s3 = new S3()

// /////////////////////////////////////////////////////////////////////
// Other Utilities

/**
 * Use this instead of <code>Math.random()</code>. This is not just a
 * shorthand. It is important that TurKit programs run the same way each time
 * they are executed. This function wraps <code>Math.random()</code> inside a
 * call to {@link TraceManager#once}.
 */
function random() {
	return once(function() {
				return Math.random()
			})
}

/**
 * Randomizes the order of the elements in <i>a</i>.
 */
function shuffle(a) {
	for (var i = 0; i < a.length; i++) {
		var ii = Math.floor(random() * a.length)
		var temp = a[i]
		a[i] = a[ii]
		a[ii] = temp
	}
	return a
}

/**
	Creates a webpage, puts it on S3, and returns the URL.
	The webpage represents a HIT.
	The webpage is created by starting with a <a href="/src/resources/task-template.html">template HTML page</a>.
	The <code>html</code> supplied to this function in injected into the template.
	If <code>bucketName</code> is not supplied,
	then the result is placed on S3 in the bucket <code>your-aws-access-key-id.TurKit</code> with the key <code>md5-hash-of-content.html</code>.
	The S3 webpage is made publicly accessible.
	The URL to the S3 webpage is returned.
	You can pass the URL to <code>s3.deleteObject</code> to remove it.
	If you supply an array or comma-delimited-string for <code>blockWorkers</code>,
	then the html page will use JavaScript to prevent those workers from completing the HIT.
	If you give any elements the class "random", then those elements will be randomly permuted each time a user views the page.
	This is good for randomizing the choices in voting tasks.
	*/
function createWebpageFromTemplate(html, blockWorkers, bucketName) {
	if (!blockWorkers) {
		blockWorkers = ""
	} else if (blockWorkers instanceof Array) {
		blockWorkers = blockWorkers.join(",")
	}
	if (!bucketName) {
		bucketName = javaTurKit.awsAccessKeyID + ".TurKit"
	}	
	var s = ("" + javaTurKit.taskTemplate).
		replace(/___CONTENT___/, html).
		replace(/___BLOCK_WORKERS___/, blockWorkers)
	var key = Packages.edu.mit.csail.uid.turkit.util.U.md5(s) + ".html"
	return s3.putString(bucketName, key, s)
}

/**
	Takes two strings <code>a</code> and <code>b</code>, and calculates their difference.
	The differences are highlighted in each result using HTML span tags with yellow backgrounds.
	There are two resulting strings of HTML, returned in an object with two properties, <code>a</code> and <code>b</code>.
 */
function highlightDiff(a, b) {
    a = a.match(/\S+|\s+/g)
    b = b.match(/\S+|\s+/g)
    diff(a, b)
    return {
        a : '<span>' + mapToSelf(a, function (word) {
            if (typeof word == "string") {
                return '<span style="background-color:yellow">' + escapeXml(word) + '</span>'
            } else {
                return escapeXml(word.text)
            }
        }).join('') + '</span>',
        b : '<span>' + mapToSelf(b, function (word) {
            if (typeof word == "string") {
                return '<span style="background-color:yellow">' + escapeXml(word) + '</span>'
            } else {
                return escapeXml(word.text)
            }
        }).join('') + '</span>'
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
