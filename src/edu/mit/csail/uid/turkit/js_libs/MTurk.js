
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
	this.init()
}

/**
 * Initialize fields of the MTurk class.
 */
MTurk.prototype.init = function() {
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
 * <li><b>maxAssignments</b>: <b>assignments</b> is also accepted. default is 1.</li>
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
		
	if (params.assignments)
		params.maxAssignments = params.assignments
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
	var url = (javaTurKit.mode == "sandbox"
					? "https://workersandbox.mturk.com/mturk/preview?groupId="
					: "https://www.mturk.com/mturk/preview?groupId=")
			+ hit.getHITTypeId()
	verbosePrint("        url: " + url)
	database.query("ensure(null, ['__HITs', " + json(javaTurKit.mode + ":" + hitId) + "], " + json({url : url}) + ")")
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
					if (a.assignmentStatus == "Submitted")
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
	
	database.query("delete __HITs[" + json(javaTurKit.mode + ":" + hitId) + "]")
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
 * <li><b>hit</b>: the HIT data structure representing the HIT on the final iteration of the voting process.</li>
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
				voteCounts : votes,
				hit : hit
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
