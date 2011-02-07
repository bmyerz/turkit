
/**
 * This module contains wrappers around mturkBase functions using once.
 * You probably want this, so that your HITs are only created once,
 * even though your script will probably crash and rerun many times.
 * 
 */
mturk = {}

/**
 * Calls {@link mturkBase.createHIT} inside of {@link once}.
 */
mturk.createHIT = function(params) {
	return once(function() {
				var hitId = mturkBase.createHIT(params)
				getCrashAndRerunFrame().url = __db.hits[hitId].url
				return hitId
			}, "createHIT")
}

/**
 * Calls {@link mturkBase.extendHIT} inside of {@link once}.
 */
mturk.extendHIT = function(hit, moreAssignments, moreSeconds) {
	return once(function() {
				return mturkBase.extendHIT(hit, moreAssignments, moreSeconds)
			}, "extendHIT")
}

/**
 * Calls {@link mturkBase.deleteHIT} inside of {@link once}.
 */
mturk.deleteHIT = function(hit) {
	once(function() {
				mturkBase.deleteHIT(hit)
			}, "deleteHIT")
}

/**
 * Calls {@link mturk.deleteHIT} for each HIT in the given hits array.
 */
mturk.deleteHITs = function(hits) {
	foreach(hits, function(hit) {
				mturk.deleteHIT(hit)
			})
}

/**
 * Calls {@link mturkBase.grantBonus} inside of {@link once}.
 */
mturk.grantBonus = function(assignment, amount, reason) {
	return once(function() {
				return mturkBase.grantBonus(assignment, amount, reason)
			}, "grantBonus")
}

/**
 * Calls {@link mturkBase.approveAssignment} inside of {@link once}.
 */
mturk.approveAssignment = function(assignment, reason) {
	return once(function() {
				return mturkBase.approveAssignment(assignment, reason)
			}, "approveAssignment")
}

/**
 * Calls {@link mturk.approveAssignment} for each assignment in the given
 * assignments array.
 */
mturk.approveAssignments = function(assignments, reason) {
	foreach(assignments, function(assignment) {
				mturk.approveAssignment(assignment, reason)
			})
}

/**
 * Calls {@link mturkBase.rejectAssignment} inside of {@link once}.
 */
mturk.rejectAssignment = function(assignment, reason) {
	return once(function() {
				return mturkBase.rejectAssignment(assignment, reason)
			}, "rejectAssignment")
}

/**
 * Calls {@link mturk.rejectAssignment} for each assignment in the given
 * assignments array.
 */
mturk.rejectAssignments = function(assignments, reason) {
	foreach(assignments, function(assignment) {
				mturk.rejectAssignment(assignment, reason)
			})
}

/**
 * Returns information about the hit if it is done (see {@link mturkBase.getHIT}),
 * otherwise it crashes.
 */
mturk.waitForHIT = function(hit) {
	var hitId = mturkBase.tryToGetHITId(hit)
	
	return once(function() {
		once(function () {
			registerMTurkNotification(hitId)
		}, "registerNotification")
		
		// the idea of this logic
		// is to minimize the number of calls to MTurk
		// to see if HITs are done.
		// 
		// if we are going to be calling waitForHIT a lot,
		// then we'd like to get a list of all reviewable HITs,
		// and check for the current HIT against that list,
		// and refresh that list only if enough time has passed.
		//
		// of course, if the list of reviewable HITs is very long,
		// then we'd rather not retrieve it,
		// unless we will be calling this function a lot,
		// so to figure out how many times we should wait before
		// retrieving the list,
		// we start by seeing how many pages of results that list has,
		// and if we call this function that many times,
		// then we go ahead and get the list

		if (!mturk.waitForHIT_callCount) {
			mturk.waitForHIT_callCount = 0
			var a = mturkBase.getReviewableHITs(1)
			if (a.totalNumResults == a.length) {
				mturk.waitForHIT_reviewableHITs = new Set(a)
				mturk.waitForHIT_reviewableHITsTime = time()
			}
			mturk.waitForHIT_waitCount = Math.ceil(a.totalNumResults / 100)
		}
		mturk.waitForHIT_callCount++
		if (mturk.waitForHIT_callCount >= mturk.waitForHIT_waitCount) {
			if (!mturk.waitForHIT_reviewableHITs ||
				(time() > mturk.waitForHIT_reviewableHITsTime + (1000 * 60))) {
				mturk.waitForHIT_reviewableHITs = new Set(mturkBase.getReviewableHITs())
				mturk.waitForHIT_reviewableHITsTime = time()
			}
		}
		if (mturk.waitForHIT_reviewableHITs) {
			if (!mturk.waitForHIT_reviewableHITs[hitId]) {
				print("\ncrashed - waiting on hit: " + hitId)
				crash()
			}
		}

		var hit = mturkBase.getHIT(hitId);
		if (!hit.done) {
			print("\ncrashed - waiting on hit: " + hitId)
			crash()
		}
		verbosePrint("hit completed: " + hitId)
		return hit
	}, "waitForHIT")
}

/**
 * Calls {@link mturk.createHIT} and then {@link mturk.waitForHIT},
 * and returns the results of the completed HIT.
 */
mturk.createHITAndWait = function(params) {
	var hitId = mturk.createHIT(params)
	return mturk.waitForHIT(hitId)
}

/**
 * Creates a HIT with the given prompt,
 * waits for someone to answer it,
 * and returns the result.
 */
mturk.prompt = function(message, params) {
	var defaultParams = {
		title : message, 
		description : message,
		reward : 0.01,
		maxAssignments: 1,
		
		regex : ".*"
	}
	if (typeof params == "number") {
	    defaultParams.maxAssignments = params
	} else if (typeof params == "object") {
	    merge(defaultParams, params)
	}
	if (!defaultParams.errorMessage) {
	    defaultParams.errorMessage = "Input must match: " + defaultParams.regex
	}
	params = defaultParams

	if (!params.question && !params.url) {	
		var x = <QuestionForm xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionForm.xsd">
	        <Question>
	            <QuestionIdentifier>response</QuestionIdentifier>
	            <IsRequired>true</IsRequired>
	            <QuestionContent>
	                {eval("<FormattedContent><![CDATA[" + message + "]]></FormattedContent>")}
	            </QuestionContent>
	            <AnswerSpecification>
	                <FreeTextAnswer>
	                    <Constraints>
	                        <Length minLength="1" maxLength="1000"></Length>
	                        <AnswerFormatRegex regex={defaultParams.regex} errorText={defaultParams.errorMessage}/>
	                    </Constraints>
	                    <DefaultText></DefaultText>
	                    <NumberOfLinesSuggestion>1</NumberOfLinesSuggestion>
	                </FreeTextAnswer>
	            </AnswerSpecification>
	        </Question>
	    </QuestionForm>
	    params.question = "" + x 
	}
    
    delete params.regex
    delete params.errorMessage
    
	var a = mturk.createHITAndWait(params)
	mturk.deleteHIT(a)
	
	var responses = map(a.assignments, function (e) {return e.answer.response})
	if (responses == 1) return responses[0]
	return responses
}

/**
 * Creates a voting HIT with the given prompt,
 * waits for people to answer it,
 * and returns the result.
 
 You may pass in a hitId as the message,
 along with a function for <code>options</code>.
 The function should accept an assignment object, and return a string
 representing the choice selected in that assignment, e.g.,
 <pre>
 function (assignment) {
     return assignment.answer.response
 }
 </pre>
 */
mturk.vote = function (message, options, votesNeeded, params) {
    if (!options) options = ["yes", "no"]
    if (!votesNeeded) votesNeeded = 2

    if (typeof options == "function") {
        var h = message
        var getVote = options
    } else {
    	var x = <QuestionForm xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionForm.xsd">
            <Question>
                <QuestionIdentifier>response</QuestionIdentifier>
                <IsRequired>true</IsRequired>
                <QuestionContent>
                    {eval("<FormattedContent><![CDATA[" + message + "]]></FormattedContent>")}
                </QuestionContent>
                <AnswerSpecification>
                    <SelectionAnswer>
                        <StyleSuggestion>radiobutton</StyleSuggestion>
                        <Selections/>
                    </SelectionAnswer>
                </AnswerSpecification>
            </Question>
        </QuestionForm>
        
        foreach(options, function (option) {
            x..*::Selections.appendChild(<Selection xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionForm.xsd">
                <SelectionIdentifier>{option}</SelectionIdentifier>
                <Text>{option}</Text>
            </Selection>)
        })
        
    	var defaultParams = {
    		title : message, 
    		description : message,
    		question : "" + x, 
    		reward : 0.01,
    		maxAssignments: votesNeeded,
    	}
    	if (typeof params == "object") {
    	    merge(defaultParams, params)
    	}
    	params = defaultParams
    	var h = mturk.createHIT(params)
    	var getVote = function (assi) {
    	    return assi.answer.response[0]
    	}
	}
	
	h = mturk.waitForHIT(h)	
	var bestOption = null
	while (true) {
	    var votes = new Bag()
	    for each (assi in h.assignments) {
	        votes.add(getVote(assi))
	    }

	    bestOption = findMax(votes)
	    if (votes[bestOption] >= votesNeeded) break
	    mturk.extendHIT(h, 1)
	    h = mturk.waitForHIT(h)
	}
	
	mturk.deleteHIT(h)
	return bestOption
}

/**
 * Creates a survey HIT with the given prompt,
 * waits for people to answer it,
 * and returns the result.
  The results is a map of each option to the number of people who chose that option.
 */
mturk.survey = function (message, options, count, params) {
    if (!options) options = ["yes", "no"]
    if (!count) count = 10

	var x = <QuestionForm xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionForm.xsd">
        <Question>
            <QuestionIdentifier>response</QuestionIdentifier>
            <IsRequired>true</IsRequired>
            <QuestionContent>
                {eval("<FormattedContent><![CDATA[" + message + "]]></FormattedContent>")}
            </QuestionContent>
            <AnswerSpecification>
                <SelectionAnswer>
                    <StyleSuggestion>radiobutton</StyleSuggestion>
                    <Selections/>
                </SelectionAnswer>
            </AnswerSpecification>
        </Question>
    </QuestionForm>
    
    foreach(options, function (option) {
        x..*::Selections.appendChild(<Selection xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionForm.xsd">
            <SelectionIdentifier>{option}</SelectionIdentifier>
            <Text>{option}</Text>
        </Selection>)
    })
    
	var defaultParams = {
		title : message, 
		description : message,
		question : "" + x, 
		reward : 0.01,
		maxAssignments: count,
	}
	if (typeof params == "object") {
	    merge(defaultParams, params)
	}
	params = defaultParams
	var h = mturk.createHITAndWait(params)
	
    var votes = new Bag()
    for each (assi in h.assignments) {
        votes.add(assi.answer.response[0])
    }
	
	mturk.deleteHIT(h)
	return votes
}
