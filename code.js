
default xml namespace =
"http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd";

var q = 
<ExternalQuestion>
  <ExternalURL>http://chi2011.org/hmslydia/experiments/TravelHacksSummary/tipCategories/getCategories2.html?answerNumber=0</ExternalURL>
  <FrameHeight>800</FrameHeight>
</ExternalQuestion>

var b = mturk.createHIT({
   title : "Help Organize Travel Tips",
   desc : "Read some travel advice found on the web, name 3 categories that two or more of the tips belong to.",
   url : "http://www.google.com" ,
   reward : .05,
   assignmentDurationInSeconds : 60*60,
   maxAssignments: 3,
   autoApprovalDelayInSeconds : 5*24*60*60,
   minApproval: 92
})

/*
,
   qualificationRequirements: [{"QualificationTypeId": "00000000000000000071", "LocaleValue" : {"Country": "US"}, "Comparator":"EqualTo"}]
*/