
ensure(null, 'hits', {})
foreach(mturkBase.getReviewableHITs(), function (hit) {
	hits[hit] = true
})
