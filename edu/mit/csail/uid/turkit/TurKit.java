package edu.mit.csail.uid.turkit;

import java.io.File;
import java.io.FileReader;
import java.io.InputStreamReader;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

import org.mozilla.javascript.Context;
import org.mozilla.javascript.JavaScriptException;
import org.mozilla.javascript.Scriptable;

import com.amazonaws.mturk.service.axis.RequesterService;
import com.amazonaws.mturk.util.ClientConfig;

public class TurKit {
	public String version = "0.1.12";
	
	public File jsFile;
	public JavaScriptBobble jsBobble;
	public RequesterService mturk;

	public boolean sandbox = false;
	public boolean verbose = true;
	public boolean safety = true;
	public double maxMoney = 10;
	public int maxHits = 100;
	public boolean crashed = false;

	public TurKit(File jsFile, String accessKey, String secretKey,
			boolean sandbox) throws Exception {
		ClientConfig conf = new ClientConfig();
		conf.setAccessKeyId(accessKey);
		conf.setSecretAccessKey(secretKey);
		conf
				.setServiceURL(sandbox ? "http://mechanicalturk.sandbox.amazonaws.com/?Service=AWSMechanicalTurkRequester"
						: "http://mechanicalturk.amazonaws.com/?Service=AWSMechanicalTurkRequester");
		Set<String> retriableErrors = new HashSet();
		retriableErrors.add("Server.ServiceUnavailable");
		conf.setRetriableErrors(retriableErrors);
		conf.setRetryAttempts(10);
		conf.setRetryDelayMillis(1000);
		init(jsFile, conf);
	}

	public TurKit(File jsFile, ClientConfig conf)
			throws Exception {
		init(jsFile, conf);
	}

	public void init(File jsFile, ClientConfig conf)
			throws Exception {
		this.jsFile = jsFile;
		jsBobble = new JavaScriptBobble(new File(jsFile.getAbsolutePath()
				+ ".bobble"), new File(jsFile.getAbsolutePath() + ".bobble.tmp"));
		mturk = new RequesterService(conf);		
		sandbox = conf.getServiceURL().contains("sandbox");
	}
	
	public void close() {
		jsBobble.close();
	}

	public boolean runOnce(double maxMoney, int maxHits) throws Exception {
		if (maxMoney < 0 || maxHits < 0) {
			safety = false;
		}
		try {
			Context cx = Context.enter();
			cx.setLanguageVersion(170);
			Scriptable scope = cx.initStandardObjects();

			scope.put("turkit", scope, this);

			URL myutil = this.getClass().getResource("/resources/myutil.js");
			cx.evaluateReader(scope, new InputStreamReader(myutil.openStream()),
					myutil.toString(), 1, null);

			URL turkit = this.getClass().getResource("/resources/turkit.js");
			cx.evaluateReader(scope, new InputStreamReader(turkit.openStream()),
					turkit.toString(), 1, null);
			
			crashed = false;			
			cx.evaluateReader(scope, new FileReader(jsFile), jsFile
					.getAbsolutePath(), 1, null);
		} catch (Exception e) {
			if (e instanceof JavaScriptException) {
				JavaScriptException je = (JavaScriptException)e;
				if (je.details().equals("crash")) {
					if (verbose) {
						System.out.println("crashed");
					}
					return false;
				}
			}
			if (verbose) {
				e.printStackTrace();
			}
			throw e;
		}
		return !crashed;
	}

	public void run(int retryAfterSeconds, double maxMoney, int maxHits)
			throws Exception {
		while (true) {
			if (runOnce(maxMoney, maxHits)) {
				break;
			}
			Thread.sleep(retryAfterSeconds * 1000);
		}
	}
}
