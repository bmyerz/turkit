var mturk = turkit.mturk

var bobble = function(s) {
	return eval("" + turkit.jsBobble.query(s))
}

var verbose = turkit.verbose

function verbosePrint(s) {
	if (verbose) {
		print(s)
	}
}

// /////////////////////////////////////////////////////////////////////
// Checkpoint Programming

(function() {
	var stackFramePath = ["__stackFrames",
			turkit.sandbox ? "sandbox" : "for-real"]
	var stackIndexes = [0]
	var visitedStackFrames = {}
	var beforePushFrame = true

	pushFrame = function(frameName) {
		beforePushFrame = false
		if (frameName) {
			stackFramePath.push("namedFrames")
			stackFramePath.push(frameName)
		} else {
			stackFramePath.push("sequencialFrames")
			stackFramePath.push(stackIndexes[stackIndexes.length - 1]++)
		}
		stackIndexes.push(0)

		var path = json(stackFramePath)

		// make sure we haven't already been here
		if (visitedStackFrames[path]) {
			throw "visiting the same stack frame twice: " + path
		}
		visitedStackFrames[path] = true

		return bobble("return prune(ensure(null, " + path + ", " + json({
					creationTime : time()
				}) + "))")
	}

	setFrameValue = function(frameName, value) {
		bobble("ensure(null, " + json(stackFramePath.concat(["values"])) + ")["
				+ json(frameName) + "] = " + json(value))
	}

	getFrameValue = function(frameName) {
		bobble("return ensure(null, " + json(stackFramePath.concat(["values"]))
				+ ")[" + json(frameName) + "]")
	}

	popFrame = function() {
		stackFramePath.pop()
		stackFramePath.pop()
		stackIndexes.pop()
	}

	once = function(func, frameName) {
		var frame = pushFrame(frameName)
		try {
			if ("returnValue" in frame) {
				frame.returnValue = bobble("return ensure(null, "
						+ json(stackFramePath) + ").returnValue")
			} else {
				frame = {
					returnValue : func(),
					returnTime : time()
				}
				bobble("merge(ensure(null, " + json(stackFramePath) + "), "
						+ json(frame) + ")")
			}
		} finally {
			popFrame()
		}
		return frame.returnValue
	}

	attempt = function(func, frameName) {
		pushFrame(frameName)
		try {
			func()
		} catch (e) {
			if ("" + e == "crash") {
				return false
			} else {
				throw e
			}
		} finally {
			popFrame()
		}
		return true
	}

	setTrace = function(frameName) {
		if (!beforePushFrame) {
			throw "you may not call setTrace from within a once or attempt, or after pushing a frame"
		}
		if (!frameName) {
			throw "you must provide an identifier or version number of some sort"
		}
		stackFramePath[1] = (turkit.sandbox ? "sandbox" : "for-real") + ":"
				+ frameName
	}

	resetTrace = function(frameName) {
		if (!beforePushFrame) {
			throw "you may not call resetTrace from within a once or attempt, or after pushing a frame"
		}
		if (!frameName) {
			throw "you must provide an identifier or version number of some sort"
		}
		stackFramePath[1] = (turkit.sandbox ? "sandbox" : "for-real") + ":"
				+ frameName
		bobble("var a = " + stackFramePath[0]
				+ "; foreach(a, function (v, k) {if (k != "
				+ json(stackFramePath[1]) + ") {delete a[k]}})")
	}

	crash = function() {
		turkit.crashed = true
		throw "crash"
	}
})()

// /////////////////////////////////////////////////////////////////////
// MTurk Wrappers and Utilities

function assertWeCanSpend(money, hits, callbackBeforeCrash) {
	if (!turkit.safety)
		return

	var safety = {
		moneySpent : 0,
		hitsCreated : 0
	}
	safety = bobble("return ensure('__safetyCounters', " + json(safety) + ")")
	safety.moneySpent += money
	safety.hitsCreated += hits
	if (safety.moneySpent > turkit.maxMoney) {
		callbackBeforeCrash()
		throw "TurKit has detected a safety violation: spending too much money."
				+ "You need to increase your spending limit with TurKit (not with MTurk) to overcome this problem."
	}
	if (safety.hitsCreated > turkit.maxHits) {
		callbackBeforeCrash()
		throw "TurKit has detected a safety violation: creating too many HITs."
				+ "You need to increase your hit limit with TurKit (not with MTurk) to overcome this problem."
	}
	safety = bobble("__safetyCounters = " + json(safety))
}

function keepTrying(func) {
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

function getAccountBalance() {
	return keepTrying(function() {
				return mturk.getAccountBalance()
			})
}

function createHitRaw(params) {
	// params.hitTypeId

	// params.title
	// params.description (also accepts params.desc)
	// params.question
	// params.reward

	// params.keywords (optional)

	// params.assignmentDurationInSeconds (default = one hour)
	// params.autoApprovalDelayInSeconds (default = one month)
	// params.lifetimeInSeconds (default = one week)
	// params.maxAssignments (default = 1)
	// params.requesterAnnotation (optional)
	// params.qualificationRequirements (optional)
	// params.minApproval (optional)
	// - creates a qualification requirement specifying that workers must have
	// an approval rating equal to or greater than the provided percentage
	// params.responseGroup (optional)

	if (!params)
		params = {}

	if (params.HITTypeID)
		params.hitTypeId = params.HITTypeID
	if (params.hitTypeId) {
	} else {
		params.hitTypeId = null
		if (!params.title)
			throw "createHit requires a title"

		if (params.desc)
			params.description = params.desc
		if (!params.description)
			throw "createHit requires a description"

		if (!params.reward)
			throw "createHit requires a reward"

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
		throw "createHit requires a question"

	if (!params.lifetimeInSeconds)
		params.lifetimeInSeconds = 60 * 60 * 24 * 7 // one week

	if (!params.maxAssignments)
		params.maxAssignments = 1

	if (!params.autoApprovalDelayInSeconds)
		params.autoApprovalDelayInSeconds = null

	if (turkit.safety) {
		if (params.hitTypeId) {
			ensure(params, 'responseGroup', []).push('HITDetail')
		} else {
			assertWeCanSpend(params.reward * params.maxAssignments,
					params.maxAssignments)
		}
	}

	if (!params.requesterAnnotation)
		params.requesterAnnotation = null

	if (!params.responseGroup)
		params.responseGroup = null

	if (!params.qualificationRequirements)
		params.qualificationRequirements = null

	var hit = keepTrying(function() {
				return mturk.createHIT(params.hitTypeId, params.title,
						params.description, params.keywords, params.question,
						params.reward, params.assignmentDurationInSeconds,
						params.autoApprovalDelayInSeconds,
						params.lifetimeInSeconds, params.maxAssignments,
						params.requesterAnnotation,
						params.qualificationRequirements, params.responseGroup);
			})

	if (turkit.safety) {
		if (params.hitTypeId) {
			assertWeCanSpend(parseFloat(hit.getReward().getAmount())
							* params.maxAssignments, params.maxAssignments,
					function() {
						disableHitRaw(hit)
					})
		} else {
		}
	}

	var hitId = "" + hit.getHITId()
	verbosePrint("created HIT: " + hitId)
	verbosePrint("        url: "
			+ (turkit.sandbox
					? "https://workersandbox.mturk.com/mturk/preview?groupId="
					: "https://www.mturk.com/mturk/preview?groupId=")
			+ hit.getHITTypeId())
	return hitId
}

function createHit(params) {
	return once(function() {
				return createHitRaw(params)
			})
}

function getReviewableHits() {
	return keepTrying(function() {
				return mturk.getAllReviewableHITs(null)
			})
}

function tryToGetHitId(hit) {
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

function tryToGetAssignmentId(assignment) {
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

function getAssignmentsForHit(hit) {
	var hitId = tryToGetHitId(hit)
	return keepTrying(function() {
				return mturk.getAllAssignmentsForHIT(hitId)
			})
}

function extendHitRaw(hit, moreAssignments, moreSeconds) {
	if (turkit.safety) {
		if (moreAssignments != null) {
			if ((typeof hit == "object") && ("reward" in hit)) {
			} else {
				hit = getHit(hit)
			}
			assertWeCanSpend(parseFloat(hit.reward) * moreAssignments,
					moreAssignments)
		}
	}

	var hitId = tryToGetHitId(hit)
	keepTrying(function() {
				mturk.extendHIT(hitId, moreAssignments, moreSeconds)
			})
	verbosePrint("extended HIT: " + hitId)
}

function extendHit(hit, moreAssignments, moreSeconds) {
	return once(function() {
				return extendHitRaw(hit, moreAssignments, moreSeconds)
			})
}

function deleteHitRaw(hit) {
	if ((typeof hit) == "object" && (hit instanceof Array)) {
		var hitIds = map(hit, function(h) {
					return tryToGetHitId(h)
				})
	} else {
		var hitIds = [tryToGetHitId(hit)]
	}
	keepTrying(function() {
				mturk.deleteHITs(hitIds, true, true, null)
			})
}

function deleteHit(hit) {
	once(function() {
				deleteHitRaw(hit)
			})
}

function deleteHits(a) {
	deleteHit(a)
}

function grantBonusRaw(assignment, bonus, reason) {
	keepTrying(function() {
				mturk.grantBonus(assignment.workerId, bonus,
						assignment.assignmentId, reason)
			})
	verbosePrint("granted bonus of " + bonus + " for assignment "
			+ assignment.assignmentId)
}

function grantBonus(assignment, bonus, reason) {
	return once(function() {
				return grantBonusRaw(assignment, bonus, reason)
			})
}

function approveAssignmentRaw(assignment, reason) {
	assignmentId = tryToGetAssignmentId(assignment)
	keepTrying(function() {
				mturk.approveAssignment(assignmentId, reason)
			})
	verbosePrint("approved assignment " + assignment.assignmentId)
}

function approveAssignment(assignment, reason) {
	return once(function() {
				return approveAssignmentRaw(assignment, reason)
			})
}

function approveAssignments(assignments, reason) {
	foreach(assignments, function(assignment) {
				approveAssignment(assignment, reason)
			})
}

function rejectAssignmentRaw(assignment, reason) {
	assignmentId = tryToGetAssignmentId(assignment)
	keepTrying(function() {
				mturk.rejectAssignment(assignmentId, reason)
			})
	verbosePrint("rejected assignment " + assignment.assignmentId)
}

function rejectAssignment(assignment, reason) {
	return once(function() {
				return rejectAssignmentRaw(assignment, reason)
			})
}

function rejectAssignments(assignments, reason) {
	foreach(assignments, function(assignment) {
				rejectAssignment(assignment, reason)
			})
}

function getHits() {
	return keepTrying(function() {
				return mturk.searchAllHITs()
			})
}

function getHit(hit) {
	var hitId = tryToGetHitId(hit)
	var hit = keepTrying(function() {
				return mturk.getHIT(hitId)
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
	foreach(getAssignmentsForHit(hitId), function(javaAssignment) {
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
				var answers = mturk.parseAnswers(javaAssignment.getAnswer())
						.getAnswer()
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

function waitForHit(hit) {
	var hitId = tryToGetHitId(hit)
	return once(function() {
				var hit = getHit(hitId);
				if (!hit.done) {
					crash()
				};
				verbosePrint("hit completed: " + hitId)
				return hit
			})
}

// /////////////////////////////////////////////////////////////////////
// MTurk High-level Utilities

function vote(hit, extractVoteFromAnswer) {
	var necessaryVoteCount = null
	var hitId = tryToGetHitId(hit)
	while (true) {
		var hit = waitForHit(hitId)

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
						approveAssignment(assignment)
					})
			deleteHit(hit)
			return winner
		} else {
			extendHit(hit, necessaryVoteCount - winnerVotes, null)
		}
	}
}

function sort(a, comparator) {
	pushFrame()
	try {
		var sortTree = getFrameValue("sortTree")
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
						setFrameValue("sortTree", sortTree)
					} else {
						done = false
					}
				})
		if (!done)
			crash()

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
		popFrame()
	}
}

function random() {
	return once(function() {
				return Math.random()
			})
}

function shuffle(a) {
	for (var i = 0; i < a.length; i++) {
		var ii = Math.floor(random() * a.length)
		var temp = a[i]
		a[i] = a[ii]
		a[ii] = temp
	}
	return a
}
