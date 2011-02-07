package turkitBridge;

import java.net.URL;
import java.util.HashSet;
import java.util.Set;

import org.mozilla.javascript.ClassShutter;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.JavaScriptException;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.UniqueTag;

import turkitOnline.RhinoUtil;
import util.MyStringWriter;
import util.U;

public class TurKit {
    public static String js_libs_path = "/turkitOnline/js_libs";
    public static String js_examples_path = "/turkitOnline/js_examples";

    public static class ReturnValue {
	public String output;
	public String db;
	public String errorCode;
	public Context cx;
	public Scriptable scope;
    }

    public static ReturnValue run(String id, String key, String mode,
	    double maxMoney, int maxHITs, String source, String db,
	    String props, long deadline) throws Exception {
	return run(id, key, mode, maxMoney, maxHITs, source, db, props, null,
		null, deadline);
    }

    public static Set<String> exposeToJava = new HashSet();
    static {
	exposeToJava.add(ExposeToJavaScript.class.getName());
	exposeToJava.add("java.lang.String");
    }

    public static ReturnValue run(String id, String key, String mode,
	    double maxMoney, int maxHITs, String source, String db,
	    String props, ExposeToJavaScript expose, Scriptable scope,
	    long deadline) throws Exception {

	Context cx = Context.enter();
	if (expose != null)
	    exposeToJava.add(expose.getClass().getName());
	if (!cx.isSealed()) {
	    cx.setClassShutter(new ClassShutter() {
		@Override
		public boolean visibleToScripts(String arg0) {
		    return exposeToJava.contains(arg0);
		}
	    });
	    cx.setLanguageVersion(170);
	    cx.setOptimizationLevel(-1);
	    cx.seal("secretSealKeyShhhhhhhhh");
	}

	if (scope == null) {
	    scope = cx.initStandardObjects();

	    if (expose == null) {
		expose = new ExposeToJavaScript();
	    }
	    scope.put("__java", scope, expose);

	    // load db
	    RhinoUtil.evaluateString(cx, scope, db, "db");
	    if (scope.get("db", scope) == UniqueTag.NOT_FOUND) {
		scope.put("db", scope, cx.newObject(scope));
	    }
	    if (scope.get("__db", scope) == UniqueTag.NOT_FOUND) {
		scope.put("__db", scope, cx.newObject(scope));
	    }

	    // load libraries (load util.js first)
	    RhinoUtil.evaluateURL(cx, scope,
		    TurKit.class.getResource(TurKit.js_libs_path + "/util.js"));
	    for (URL u : U
		    .getResourceListing(TurKit.class, TurKit.js_libs_path)) {
		if (u.toString().endsWith(TurKit.js_libs_path + "/util.js"))
		    continue;
		RhinoUtil.evaluateURL(cx, scope, u);
	    }

	    // load props
	    RhinoUtil.evaluateString(cx, scope, props, "props");
	    RhinoUtil
		    .evaluateString(
			    cx,
			    scope,
			    "ensure(null, 'props', {})\n"
				    + "if (!props.awsId || props.awsId.length == 0) props.awsId = "
				    + RhinoUtil.json(id)
				    + "\n"
				    + "if (!props.awsKey || props.awsKey.length == 0) props.awsKey = "
				    + RhinoUtil.json(key) + "\n"
				    + "if (!props.mode) props.mode = "
				    + RhinoUtil.json(mode) + "\n"
				    + "if (!props.maxMoney) props.maxMoney = "
				    + RhinoUtil.json(maxMoney) + "\n"
				    + "if (!props.maxHITs) props.maxHITs = "
				    + RhinoUtil.json(maxHITs) + "\n",
			    "propsDefault");
	}

	scope.put("__deadline", scope, deadline);

	// run script
	expose = (ExposeToJavaScript) scope.get("__java", scope);
	MyStringWriter out = expose.dontExpose.out;
	String errorCode = "finished";
	try {
	    RhinoUtil.evaluateString(cx, scope, source, "main.js");
	    if (U.getBoolean(RhinoUtil
		    .evaluateString(
			    cx,
			    scope,
			    "!!(__db && __db.crashAndRerun && __db.crashAndRerun.forks)",
			    "check_forks"))) {
		errorCode = "crashed";
	    }
	} catch (Exception e) {
	    if (e instanceof JavaScriptException) {
		JavaScriptException je = (JavaScriptException) e;
		if (je.details().equals("crash")) {
		    errorCode = "crashed";
		}
	    }
	    if (errorCode.equals("finished")) {
		e.printStackTrace(out);
		errorCode = "error";
	    }
	} catch (Error e) {
	    e.printStackTrace(out);
	    errorCode = "error";
	}

	// return results
	ReturnValue ret = new ReturnValue();
	ret.output = out.toString()
		+ (errorCode.equals("crashed") ? "\ncrashed - ready to rerun"
			: "");
	ret.db = "db = " + RhinoUtil.json(scope.get("db", scope)) + "\n__db = "
		+ RhinoUtil.json(scope.get("__db", scope));
	ret.errorCode = errorCode;
	ret.cx = cx;
	ret.scope = scope;
	return ret;
    }
}
