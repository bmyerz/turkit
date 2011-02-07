
(function () {
	/**
	 * This module contains helper functions for making REST requests to Mechanical Turk.
	 * 
	 * Note that it uses the AWS access keys supplied in props,
	 * as well as the mode (either "real" or "sandbox").
	 */
	mturkBase = {}
	
	mturkBase.assertWeCanSpend = function(money, hits, callbackBeforeCrash) {
		var safety = ensure(__db, 'safetyCounters', {
			moneySpent : 0,
			hitsCreated : 0
		})
		if (safety.moneySpent + money > props.maxMoney) {
			if (callbackBeforeCrash)
				callbackBeforeCrash()
			throw "TurKit has detected a safety violation: spending too much money.\n"
					+ "You need to increase your spending limit with TurKit (not with MTurk) to overcome this problem."
		}
		if (safety.hitsCreated + hits > props.maxHITs) {
			if (callbackBeforeCrash)
				callbackBeforeCrash()
			throw "TurKit has detected a safety violation: creating too many HITs.\n"
					+ "You need to increase your hit limit with TurKit (not with MTurk) to overcome this problem."
		}
		safety.moneySpent += money
		safety.hitsCreated += hits
	}
	
	mturkBase.tryToGetHITId = function(hit) {
		if ((typeof hit) == "xml") {
			return '' + hit..HITId
		} else if ((typeof hit) == "object") {
			try {
				if (hit.hitId) {
					return hit.hitId
				}
			} catch (e) {
			}
			return "" + hit
		}
		return hit
	}
	
	mturkBase.tryToGetAssignmentId = function(assignment) {
		if ((typeof assignment) == "xml") {
			return '' + assignment..AssignmentId
		} else if ((typeof assignment) == "object") {
			try {
				if (assignment.assignmentId) {
					return assignment.assignmentId
				}
			} catch (e) {
			}
			return "" + assignment
		}
		return assignment
	}
	
	/**
	 * Returns the number of dollars in the user's MTurk account.
	 */
	mturkBase.getAccountBalance = function() {
		var x = mTurkRestRequest("GetAccountBalance")
		return parseFloat(x..AvailableBalance.Amount)
	}
	
	/**
	 * Creates a HIT. params is an object with the following properties:
	 * <ul>
	 * <li><b>title</b>: displayed in the list of HITs on MTurk.</li>
	 * <li><b>description</b>: <b>desc</b> is also accepted.
	 * 		A slightly longer description of the HIT,
	 * 		also shown in the list of HITs on MTurk</li>
	 * <li><b>question</b>: a string of XML specifying what will be shown. <a
	 * href="http://docs.amazonwebservices.com/AWSMechanicalTurkRequester/2008-08-02/index.html?ApiReference_QuestionFormDataStructureArticle.html">See documentation here</a>.
	 * Instead of question, you may use the following special parameters:
	 * <ul>
	 * 		<li><b>url</b>: creates an external question pointing to this URL</li>
	 * 		<li><b>height</b>: (optional) height of the iFrame embedded in MTurk, in pixels (default is 600).</li>
	 * </ul>
	 * </li>
	 * <li><b>reward</b>: how many dollars you want to pay per assignment for this HIT.
	 * </ul>
	 * The following properties are optional:
	 * <ul>
	 * <li><b>keywords</b>: keywords to help people search for your HIT.</li>
	 * <li><b>assignmentDurationInSeconds</b>: default is 1 hour's worth of seconds.</li>
	 * <li><b>autoApprovalDelayInSeconds</b>: default is 1 month's worth of seconds.</li>
	 * <li><b>lifetimeInSeconds</b>: default is 1 week's worth of seconds.</li>
	 * <li><b>maxAssignments</b>: <b>assignments</b> is also accepted. default is 1.</li>
	 * <li><b>requesterAnnotation</b>: default is no annotation.</li>
	 * <li><b>qualificationRequirements</b>: default is no requirements.</li>
	 * <li><b>minApproval</b>: minimum approval percentage.
	 * 		The appropriate requirement will be added if you supply a percentage here.</li>
	 * </ul>
	 */
	mturkBase.createHIT = function(params) {
		if (!params)
			params = {}
			
		// let them know if they provide param names that are not on the list
		var badKeys = keys(new Set(keys(params)).remove([
			"title",
			"desc",
			"description",
			"reward",
			"assignmentDurationInSeconds",
			"minApproval",
			"html",
			"bucket",
			"url",
			"blockWorkers",
			"height",
			"question",
			"lifetimeInSeconds",
			"assignments",
			"maxAssignments",
			"numAssignments",
			"autoApprovalDelayInSeconds",
			"requesterAnnotation",
			"keywords",
			"qualificationRequirements",
		]))
		if (badKeys.length > 0) {
			throw "some parameters to createHIT are not understood: " + badKeys.join(', ')
		}
	
		if (!params.title)
			throw "createHIT requires a title"
	
		if (params.desc)
			params.description = params.desc
		if (!params.description)
			throw "createHIT requires a description"
	
		if (params.reward == null)
			throw "createHIT requires a reward"
	
		if (!params.assignmentDurationInSeconds)
			params.assignmentDurationInSeconds = 60 * 60 // one hour
	
		if (params.minApproval) {
			var q = ensure(params, "qualificationRequirements", [])
			var i = (q.length / 3) + 1
			q.push("QualificationRequirement." + i + ".QualificationTypeId")
			q.push("000000000000000000L0")
			q.push("QualificationRequirement." + i + ".Comparator")
			q.push("GreaterThanOrEqualTo")
			q.push("QualificationRequirement." + i + ".IntegerValue")
			q.push(params.minApproval)
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
			throw "createHIT requires a question (or a url)"
	
		if (!params.lifetimeInSeconds)
			params.lifetimeInSeconds = 60 * 60 * 24 * 7 // one week
			
		if (params.assignments)
			params.maxAssignments = params.assignments
		if (params.numAssignments)
			params.maxAssignments = params.numAssignments 
		if (!params.maxAssignments)
			params.maxAssignments = 1
	
		if (!params.autoApprovalDelayInSeconds)
			params.autoApprovalDelayInSeconds = null
	
		mturkBase.assertWeCanSpend(params.reward * params.maxAssignments, 1)
	
		if (!params.requesterAnnotation)
			params.requesterAnnotation = null
	
		if (!params.responseGroup)
			params.responseGroup = null
	
		if (!params.qualificationRequirements)
			params.qualificationRequirements = null
	
		var x = mTurkRestRequest("CreateHIT",
				["Title", params.title,
				"Description", params.description,
				"Question", params.question,
				"Reward.1.Amount", params.reward,
				"Reward.1.CurrencyCode", "USD",
				"AssignmentDurationInSeconds", params.assignmentDurationInSeconds,
				"LifetimeInSeconds", params.lifetimeInSeconds,
				"Keywords", params.keywords,
				"MaxAssignments", params.maxAssignments,
				"AutoApprovalDelayInSeconds", params.autoApprovalDelayInSeconds,
				"RequesterAnnotation", params.requesterAnnotation].
				concat(params.qualificationRequirements ? params.qualificationRequirements : [])
			)
		var hit = x..HIT
		
		var hitId = mturkBase.tryToGetHITId(hit)
		
		verbosePrint("created HIT: " + hitId)
		var url = (props.mode == "sandbox"
						? "https://workersandbox.mturk.com/mturk/preview?groupId="
						: "https://www.mturk.com/mturk/preview?groupId=")
				+ hit.HITTypeId
		verbosePrint("        url: " + url)
		ensure(__db, ['hits', hitId], {url : url, mode : props.mode})
		return hitId
	}
	
	/**
	 * Returns a list of HIT Ids of HITs that are ready to be reviewed.
	 * You may optionally specify <code>maxPages</code>,
	 * to limit the number of pages of results returned.
	 * Each page will have up to 100 reviewable HIT Ids.
	 * If <code>maxPages</code> is specified,
	 * then the return value will have a property called <code>totalNumResults</code>,
	 * which indicates how many HITs are reviewable.
	 */
	mturkBase.getReviewableHITs = function(maxPages) {
	    var all = []
	    var page = 1
	    var processedResults = 0
	    var totalNumResults = 0
	    while (!maxPages || (page <= maxPages)) {
	        var x = mTurkRestRequest("GetReviewableHITs",
	            ["SortProperty", "CreationTime",
	            "PageSize", "100",
	            "PageNumber", "" + page])
	        foreach(x..HITId, function (hitId) {
	        	all.push("" + hitId)
	        })
	        var numResults = parseInt(x..NumResults)
	        if (numResults <= 0) break
	        processedResults += numResults
	        totalNumResults = parseInt(x..TotalNumResults)
	        if (processedResults >= totalNumResults) break
	        page++
	    }
	    if (maxPages) {
	    	all.totalNumResults = totalNumResults
	    }
	    return all
	}
	
	/*
	input: a HIT XML element from MTurk
	output: a JS object representing the HIT
	 */
    var xmlNull = new XML()..blah
    function g(x) {
        if (x == xmlNull) return null
        return "" + x
    }
    function gi(x) {
        if (x == xmlNull) return null
        return parseInt(x)
    }
    function gf(x) {
        if (x == xmlNull) return null
        return parseFloat(x)
    }
	function parseMTurkTime(s) {
	    var m = s.match(/(\d+)-(\d+)-(\d+)T([0-9:]+)Z/)
	    return Date.parse(m[2] + "/" + m[3] + "/" + m[1] + " " + m[4] + " GMT")
	}
    function gt(x) {
        if (x == xmlNull) return null
        return parseMTurkTime(x)
    }	
	function parseHIT(hit) {
		return {
			hitId : g(hit.HITId),
			hitTypeId : g(hit.HITTypeId),
			title : g(hit.Title),
			description : g(hit.Description),
			keywords : g(hit.Keywords),
			reward : gf(hit.Reward.Amount),
			question : g(hit.Question),
			maxAssignments : gi(hit.MaxAssignments),
			assignmentDurationInSeconds : gi(hit.AssignmentDurationInSeconds),
	        autoApprovalDelayInSeconds : gi(hit.AutoApprovalDelayInSeconds),
			requesterAnnotation : g(hit.RequesterAnnotation),
			hitStatus : g(hit.HITStatus),
			hitReviewStatus : g(hit.HITReviewStatus),
			creationTime : gt(hit.CreationTime),
			expiration : gt(hit.Expiration)
		}
	}
	
	/**
	 * Returns an object representing all of the information MTurk has on the given
	 * HIT, including the assignments, and the associated answer data. The returned
	 * object will have a value called done set to true iff all the pending
	 * assignments for this HIT have been completed (unless getAssignments is false).
	 * 
	 * getAssignments defaults to true.
	 * 
	 * Note that the answer data structure associated with each assignment is
	 * simplified. It is recommended that you print out the result of this function
	 * using json, in order to know what it looks like for your specific situation.
	 */
	mturkBase.getHIT = function(hit, getAssignments) {
	
		if (getAssignments === undefined) getAssignments = true
	
		var hitId = mturkBase.tryToGetHITId(hit)
		var x = mTurkRestRequest("GetHIT", ["HITId", hitId])
	    hit = parseHIT(x..HIT)
	    
	    if (!getAssignments) return hit
	    
	    hit.assignments = []
	    
	    function processAssignment(a) {
	        // NOTE: we use the singular "answer" instead of "answers"
	        // to be consistent with MTurk
	        var answer = {}
	    
	        var answers = a.Answer
	        answers = answers.substring(answers.indexOf("?>\n") + 3)
	        answers = new XML(answers)
	        foreach(answers.*::Answer, function (a) {
	            var rhs = g(a.*::FreeText)
	            if (rhs == null) {
	                rhs = g(a.*::UploadedFileKey)
	                if (rhs != null) {
	                    rhs = {
	                        uploadedFileKey : rhs,
	                        uploadedFileSizeInBytes : gi(a.*::UploadedFileSizeInBytes)
	                    }
	                }
	            }
	            if (rhs == null) {
	                rhs = []
	                foreach(a.*::SelectionIdentifier, function (sel) {
	                    rhs.push("" + sel)
	                })
	                var o = g(a.*::OtherSelectionText)
	                if (o != null) {
	                    rhs.push(o)
	                }
	            }
	
	            answer[g(a.*::QuestionIdentifier)] = rhs
	        })
	    
	        hit.assignments.push({
	            assignmentId : g(a.AssignmentId),
	            workerId : g(a.WorkerId),
	            hitId : g(a.HITId),
	            assignmentStatus : g(a.AssignmentStatus),
	            autoApprovalTime : gt(a.AutoApprovalTime),
	            acceptTime : gt(a.AcceptTime),
	            submitTime : gt(a.SubmitTime),
	            answer : answer,
	            requesterFeedback : g(a.RequesterFeedback),
	            approvalTime : gt(a.ApprovalTime),
	            deadline : gt(a.Deadline),
	            rejectionTime : gt(a.RejectionTime)
	        })
	    }
	    
	    var page = 1
	    var processedResults = 0
	    var totalNumResults = 0
	    while (true) {
	        var x = mTurkRestRequest("GetAssignmentsForHIT",
	            ["HITId", hitId,
	            "PageSize", "100",
	            "PageNumber", "" + page])
	        for each (a in x..Assignment) {
	            processAssignment(a)
	        }
	        var numResults = parseInt(x..NumResults)
	        if (numResults <= 0) break
	        processedResults += numResults
	        totalNumResults = parseInt(x..TotalNumResults)
	        if (processedResults >= totalNumResults) break
	        page++
	    }
	
		hit.done = (hit.hitStatus == "Reviewable")
				&& (hit.assignments.length == hit.maxAssignments)
		return hit
	}
	
	/**
	 * Extends the hit by the given number of assignments (moreAssignments),
	 * and the given number of seconds (moreSeconds).
	 */
	mturkBase.extendHIT = function(hit, moreAssignments, moreSeconds) {
		if (moreAssignments != null) {
			if ((typeof hit == "object") && ("reward" in hit)) {
			} else {
				hit = mturkBase.getHIT(hit)
			}
			mturkBase.assertWeCanSpend(parseFloat(hit.reward) * moreAssignments, 0)
		}
	
		var hitId = mturkBase.tryToGetHITId(hit)
		var params = ["HITId", hitId]
	    if (moreAssignments) {
	        params.push("MaxAssignmentsIncrement")
	        params.push("" + moreAssignments)
	    }
	    if (moreSeconds) {
	        params.push("ExpirationIncrementInSeconds")
	        params.push(moreSeconds)
	    }
		var x = mTurkRestRequest("ExtendHIT", params)
		verbosePrint("extended HIT: " + hitId)
	}
	
	/**
	 * Deletes the given hit.
	 * If there are any completed assignments that have not been approved or rejected,
	 * then they are approved.
	 */
	mturkBase.deleteHIT = function(hit) {
		var hitId = mturkBase.tryToGetHITId(hit)
	    ;(function () {
	    
	        // try disabling the HIT
			try {
		        mTurkRestRequest("DisableHIT", ["HITId", hitId])
	            verbosePrint("disabled HIT: " + hitId)
	            return
	        } catch (e if ("" + e).match(/^MTurk error/)) {
			}
	        
	        // see if we already deleted the HIT
	        var hit = mturkBase.getHIT(hitId)
	        if (hit.hitStatus == "Disposed") {
	            verbosePrint("already deleted HIT: " + hitId)
	            return
	        }
	        
	        // ok, it must be "Reviewable"
	        // (since we couldn't disable it, and it isn't already deleted)
	        
	        // first, approve all the assignments
	        foreach(hit.assignments, function (a) {
	            if (a.assignmentStatus == "Submitted")
	                mturkBase.approveAssignment(a)
	        })
	        
	        // next, dispose of the HIT
	        mTurkRestRequest("DisposeHIT", ["HITId", hitId])
            verbosePrint("disposed HIT: " + hitId)
			return
	    })()
		delete __db.hits[hitId]
	}
	
	/**
	 * Grants a bonus of the given amount to the given
	 * assignment for the stated reason.
	 */
	mturkBase.grantBonus = function(assignment, amount, reason) {
		mTurkRestRequest("GrantBonus",
			["WorkerId", assignment.workerId,
			"AssignmentId", assignment.assignmentId,
			"BonusAmount.1.Amount", amount,
			"BonusAmount.1.CurrencyCode", "USD",
			"Reason", reason])
		verbosePrint("granted bonus of " + amount + " for assignment "
				+ assignment.assignmentId)
	}
	
	/**
	 * Approves the given assignment, and provides an optional reason.
	 */
	mturkBase.approveAssignment = function(assignment, reason) {
		var assignmentId = mturkBase.tryToGetAssignmentId(assignment)
	
		var params = ["AssignmentId", assignmentId]
		if (reason) {
			params.push("RequesterFeedback")
			params.push(reason)
		}
		mTurkRestRequest("ApproveAssignment", params)
		verbosePrint("approved assignment " + assignmentId)
	}
	
	/**
	 * Rejects the given assignment, and provides an optional reason.
	 */
	mturkBase.rejectAssignment = function(assignment, reason) {
		var assignmentId = mturkBase.tryToGetAssignmentId(assignment)
	
		var params = ["AssignmentId", assignmentId]
		if (reason) {
			params.push("RequesterFeedback")
			params.push(reason)
		}
		mTurkRestRequest("RejectAssignment", params)
		verbosePrint("rejected assignment " + assignmentId)
	}
	
	/**
	 * Returns an array of HIT data for all the HITs you currently have on MTurk.
	 */
	mturkBase.getHITs = function(maxPages) {
	    var self = mturkBase
	    var all = []
	    var page = 1
	    var processedResults = 0
	    var totalNumResults = 0
	    while (!maxPages || (page <= maxPages)) {
	        var x = mTurkRestRequest("SearchHITs",
	            ["SortProperty", "CreationTime",
	            "SortDirection", "Descending",
	            "PageSize", "100",
	            "PageNumber", "" + page])
	        foreach(x..HIT, function (hit) {
	            all.push(parseHIT(hit))
	        })
	        var numResults = parseInt(x..NumResults)
	        if (numResults <= 0) break
	        processedResults += numResults
	        totalNumResults = parseInt(x..TotalNumResults)
	        if (processedResults >= totalNumResults) break
	        page++
	    }
	    if (maxPages) {
	    	a.totalNumResults = totalNumResults
	    }
	    return all
	}
	
})()
