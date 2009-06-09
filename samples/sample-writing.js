
var text = ""

for (var i = 0; i < 5; i++) {
	// improve text
    var hitId = createImproveHIT(text, 0.02)
    var hit = mturk.waitForHIT(hitId)
    
    var newText = hit.assignments[0].answer.newText
    print("-------------------")
    print(newText)
    
    // verify improvement
    if (vote(text, newText, 0.01)) {
        text = newText
        mturk.approveAssignment(assignment)
        print("\nvote = keep\n")
    } else {
        mturk.rejectAssignment(assignment)
        print("\nvote = reject\n")
    }    
}


function createImproveHIT(oldText, improveCost) {
    default xml namespace = "http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2005-10-01/QuestionForm.xsd";
    var q = <QuestionForm>
        <Question>
            <QuestionIdentifier>newText</QuestionIdentifier>
            <IsRequired>true</IsRequired>
            <QuestionContent>
                <FormattedContent><![CDATA[
<p><b>Please improve the description for this sonnet.</b></p>
<p>Sweet love, renew thy force; be it not said<br/>
Thy edge should blunter be than appetite,<br/>
Which but to-day by feeding is allay'd,<br/>
To-morrow sharpened in his former might:<br/>
So, love, be thou, although to-day thou fill<br/>
Thy hungry eyes, even till they wink with fulness,<br/>
To-morrow see again, and do not kill<br/>
The spirit of love, with a perpetual dulness.<br/>
Let this sad interim like the ocean be<br/>

Which parts the shore, where two contracted new<br/>
Come daily to the banks, that when they see<br/>
Return of love, more blest may be the view;</p>
<dl>
<dd>Or call it winter, which being full of care,</dd>
<dd>Makes summer's welcome, thrice more wished, more rare.</dd>
</dl>
]]></FormattedContent>
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
    
    return mturk.createHIT({title : "Improve Text", desc : "Improve a small paragraph toward a goal.", question : "" + q, reward : improveCost})
}


function vote(textA, textB, voteCost) {
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
    var voteHitId = mturk.createHIT({title : "Vote on Text Improvement", desc : "Decide which two small paragraphs is closer to a goal.", question : "" + q,  reward : voteCost, maxAssignments : 2})
    var voteResults = mturk.vote(voteHitId, function (answer) {return answer.vote[0]})
    return voteResults.bestOption == "b"
}
