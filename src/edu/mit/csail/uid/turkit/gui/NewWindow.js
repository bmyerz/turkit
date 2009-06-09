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
var jsFile = new Packages.java.io.File(filename)
if (!jsFile.exists()) {
	Packages.edu.mit.csail.uid.turkit.util.U.saveString(jsFile, defaultFileContents)
}
Packages.edu.mit.csail.uid.turkit.gui.Main(jsFile,
		awsAccessKeyID, awsSecretAccessKey, sandbox, maxMoney, maxHITs)
