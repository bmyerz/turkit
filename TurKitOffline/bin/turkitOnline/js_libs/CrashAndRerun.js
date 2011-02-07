
(function () {
	function initFrame(frame) {
		if (frame.nextFrame) frame.nextFrame = 0
		if (frame.forks) frame.forks = 0
		return frame
	}
	
	var frameStack = []
	frameStack.push(initFrame(ensure(__db, ["crashAndRerun"])))

	getCrashAndRerunFrame = function () {
		return last(frameStack)
	}	
	
	function pushFrame(name) {
		var parent = last(frameStack)
		var frames = ensure(parent, ["frames"], [])
		var nextFrame = ensure(parent, ["nextFrame"], 0)
		if (nextFrame > frames.length - 1) {
			var frame = {
				creationTime : time()
			}
			if (name) frame.name = name
			frames.push(frame)
		} else {
			var frame = frames[nextFrame]
			if (name && (name != frame.name)) {
				throw "saw: " + name + "\n" +
					"expected: " + frame.name + "\n" +
					"The program is out of sync with the database, or the program is non-deterministic."
			}
		}
		frameStack.push(initFrame(frame))
		parent.nextFrame++
		return frame
	}
	
	function popFrame() {
		frameStack.pop()
	}
	
	/**
	 * Calls the function func only once;
	 * subsequent runs of the program will not call func
	 * if it returns successfully this time.
	 * If func crashes, then it will be called again when the program is rerun.
	 * 
	 * The name parameter is used for error checking.
	 * Subsequent runs of the program will make sure that name is the same.
	 */
	once = function (func, name) {
	    if (!name) name = "unnamed command"
		var frame = pushFrame(name)
		try {
			if ("returnValue" in frame) {
				if ("printOutput" in frame) {
					print(frame.printOutput)
				}
			} else {
				var wireTap = __java.wireTapOpen()
				frame.returnValue = func()
				frame.printOutput = __java.wireTapClose(wireTap)
				frame.returnTime = time()
			}
		} finally {
			popFrame()
		}
		return frame.returnValue
	}
	
	/**
	 * Executes func in a pseudo-thread;
	 * if func crashes with a call to crash,
	 * the program will keep running after this call to fork.
	 * 
	 * Returns true iff func finishes successfully.
	 * 
	 */
	fork = function(func, name) {
		var parent = last(frameStack)
		ensure(parent, ["forks"], 0)
		parent.forks++
		
		var frame = pushFrame(name)
		frame.name = "fork"
		try {
			func()
			join()
			parent.forks--
		} catch (e if ("" + e == "crash")) {
			return false
		} finally {
			popFrame()
		}
		return true
	}
	
	/**
	 * Makes sure all the forks have finished, otherwise we crash.
	 * 
	 */
	join = function () {
		var frame = last(frameStack)
		if (frame.forks) crash()
	}
	
	/**
	 * Throws a "crash" exception.
	 * This is the preferred way of ending execution
	 * when waiting on external data,
	 * like HITs on Mechanical Turk.
	 * 
	 * Note that the "crash" exception is caught by fork.
	 * 
	 Prints out the given <code>msg</code> too.
	 */
	crash = function (msg) {
	    if (msg) {
	        print(msg)
	    }
		throw "crash"
	}
	
	/**
	 * Throws a "crash" exception.
	 * This is a pseudonym for crash.
	 * 
	 Prints out the given <code>msg</code> too.
	 */
	
	stop = function (msg) {
		crash(msg)
	}

})()
