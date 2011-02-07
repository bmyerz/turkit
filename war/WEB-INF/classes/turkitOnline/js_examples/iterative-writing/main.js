
var imageUrl = "/public-domain-images/trees.png"

var numIterations = 3
var iterationReward = 0.02
var minVotes = 2

var text = ""
var blockWorkers = new Set()
for (var i = 0; i < numIterations; i++) {
    // improve text
    var newText = improveText(imageUrl, text, iterationReward, blockWorkers )
    print("------ iteration " + i + " ------")
    print(newText)

    // vote whether to keep it
    if (voteOnText(imageUrl, newText, text, minVotes, blockWorkers)) {
        text = newText
        print("\nvoted to keep")
    } else {
        print("\nvoted to discard")
    }
}

function improveText(imageUrl, text, reward, blockTurkers) {
    var extra = (text != "") ? <li>You may use the provided text as a starting point, or delete it and start over.</li> : ""
    var w = webpage.createHITTemplate(("" + <div>
        <script>
        /* <![CDATA[ */
        $(function () {
            function onChange() {
                var maxChars = 500
            
                var newText = $('textarea[name=newText]').val()
                var oldText = $('#oldText').val()
                
                var charCount = newText.length
                
                var message = ""
                if (charCount == 0) {
                    message = "please type something above"
                } else if (charCount > maxChars) {
                    message = '<b style="color:red">please make it shorter</b>'
                } else if (newText == oldText) {
                    message = "please change the text"
                }
                
                $('#charCount').html('character count: ' + charCount + '/' + maxChars + ' &nbsp;&nbsp;&nbsp;' + message)
                
                if (message == "") {
                    $('input[type=submit]').removeAttr('disabled')
                } else {
                    $('input[type=submit]').attr('disabled', 'true')
                }
            }
            $('textarea[name=newText]').keydown(onChange)
            $('textarea[name=newText]').keyup(onChange)
            onChange()
        })
        /* ]]> */
        </script>
        <img width="500px" src={imageUrl} />
        <table>
            <tr>
                <td valign="bottom"><div style="width:500px">
                    <ul>
                        <li>Please describe the image <b>factually</b>.</li>
                        {extra}
                        <li>Use no more than 500 characters.</li>
                    </ul>
                </div></td>
            </tr>
            <tr>
                <td><textarea name="newText" style="width:500px;height:170px">___text___</textarea><textarea id="oldText" style="display:none">___text___</textarea></td>
            </tr>
        </table>
        <div id="charCount">character count: 0 (update me)</div>
        <input type="submit" value="Submit"></input>
    </div>).replace(/___text___/g, text), keys(blockTurkers))
    // why do we do replace instead of embedding text in the XML?
    // because Rhino changes <textarea></textarea> into <textarea/>, which is not valid html

    var h = mturk.createHITAndWait({
        title: "Describe Image Factually",
        desc: "Please describe the given image factually.",
        url: w,
        height: 800,            
        reward: reward})
    mturk.deleteHIT(h)
    webpage.remove(w)

    blockTurkers.add(map(h.assignments, function (e) {return e.workerId}))

    return h.assignments[0].answer.newText
}

function voteOnText(imageUrl, textA, textB, minVotes, blockTurkers) {
    var diff = highlightDiff(textA, textB)
    var w = webpage.createHITTemplate(("" + <div>
        <img style="padding-left:30px" width="500px" src={imageUrl} />
        <table>
            <tr>
                <td valign="bottom"><div style="padding-left:30px;width:500px">
                    <ul>
                        <li>Please choose the better <b>factual</b> description of the image.</li>
                    </ul>
                </div></td>
            </tr>
            <tr>
                <td valign="top">
                
                <table class="random">
                    <tr><td><input name="voteA" type="submit" value="&gt;" style="width:30px;height:170px"></input></td><td><pre style="width:500px; white-space: pre-wrap; white-space: -moz-pre-wrap; white-space: -o-pre-wrap;">___textA___</pre></td></tr>
                </table>
                
                <div style="height:10px"></div>
                
                <table class="random">
                    <tr><td><input name="voteB" type="submit" value="&gt;" style="width:30px;height:170px"></input></td><td><pre style="width:500px; white-space: pre-wrap; white-space: -moz-pre-wrap; white-space: -o-pre-wrap;">___textB___</pre></td></tr>
                </table>
                
                </td>
            </tr>
        </table>
        </div>).replace(/___textA___/g, diff.a).replace(/___textB___/g, diff.b), blockTurkers)
    // why do we do replace instead of embedding text in the XML?
    // because Rhino changes <textarea></textarea> into <textarea/>, which is not valid html

    var h = mturk.createHIT({
        title: "Choose Better Factual Image Description",
        desc: "Please choose the better factual description for the given image.",
        url: w,
        height: 800,            
        assignments : minVotes,
        reward: 0.01})
    var v = mturk.vote(h, function (a) {return a.answer.voteA ? "A" : "B"}, minVotes)
    webpage.remove(w)
    return v == "A"
}
