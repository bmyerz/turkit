if (a = input.match(/^\w+\s+=[ \t]*$/m)) {
	throw "You need a value on line:\n\n" + a[0]
}

input = input.replace(/(=[ \t]+)([^\r\n]+)/g, function(s, a, b) {
			if (b.match(/^"|^[0-9.]+$|^true$|^false$/)) {
				return s
			} else {
				return a + json(b)
			}
		})

eval(input)
Packages.edu.mit.csail.uid.turkit.gui.Main(new Packages.java.io.File(jsFile),
		awsAccessKey, awsSecretAccessKey, sandbox, maxMoney, maxHits)