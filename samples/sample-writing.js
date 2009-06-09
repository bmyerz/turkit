
setTrace(1)

function createImproveQuestion(oldText) {
    default xml namespace = "http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionForm.xsd";
    var q = <QuestionForm>
        <Question>
            <QuestionIdentifier>newText</QuestionIdentifier>
            <IsRequired>true</IsRequired>
            <QuestionContent>
                <Text>Please improve the following description of the taste of salt:</Text>
            </QuestionContent>
            <AnswerSpecification>
                <FreeTextAnswer>
                    <Constraints>
                        <Length minLength="2" maxLength="500"></Length>
                        <AnswerFormatRegex regex="\S" errorText="The content cannot be blank."/>
                    </Constraints>
                    <DefaultText>{oldText}</DefaultText>
                    <NumberOfLinesSuggestion>3</NumberOfLinesSuggestion>
                </FreeTextAnswer>
            </AnswerSpecification>
        </Question>
    </QuestionForm>
    return "" + q
}

function createVoteQuestion(textA, textB) {
    default xml namespace = "http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionForm.xsd";
    var q = <QuestionForm>
        <Question>
            <QuestionIdentifier>vote</QuestionIdentifier>
            <IsRequired>true</IsRequired>
            <QuestionContent>
                <Text>Which is a better description of the taste of salt?</Text>
            </QuestionContent>
            <AnswerSpecification>
                <SelectionAnswer>
                    <Selections>
                    </Selections>
                </SelectionAnswer>
            </AnswerSpecification>
        </Question>
    </QuestionForm>

    var options = [{key:"a",value:textA}, {key:"b",value:textB}]
    shuffle(options)
    foreach(options, function (op) {
        default xml namespace = "http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionForm.xsd";
        q.Question.AnswerSpecification.SelectionAnswer.Selections.Selection +=
            <Selection>
                <SelectionIdentifier>{op.key}</SelectionIdentifier>
                <Text>{op.value}</Text>
            </Selection>
    })
    return "" + q
}

var text = ""
var money = 0.5
var improveCost = 0.02
var voteCost = 0.01

while (money > 0) {
	// improve text
    var hitId = mturk.createHit({title : "Improve Text", desc : "Improve a small paragraph toward a goal.", question : createImproveQuestion(text),  reward : improveCost})
    var hit = mturk.waitForHit(hitId)
    var assignment = hit.assignments[0]
    var newText = assignment.answer.newText
    
    // verify improvement
    var voteHitId = mturk.createHit({title : "Vote on Text Improvement", desc : "Decide which two small paragraphs is closer to a goal.", question : createVoteQuestion(text, newText),  reward : voteCost, maxAssignments : 2})
    var voteResults = mturk.vote(voteHitId, function (answer) {return answer.vote[0]})
    
    money -= voteResults.totalVoteCount * voteCost
    
    if (voteResults.bestOption == "b") {
        text = newText
        mturk.approveAssignment(assignment)
        money -= improveCost
    } else {
        mturk.rejectAssignment(assignment)
    }    
}
