package edu.mit.csail.uid.turkit;

import java.io.File;
import java.io.FileReader;
import java.io.InputStreamReader;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.mozilla.javascript.Context;
import org.mozilla.javascript.JavaScriptException;
import org.mozilla.javascript.Scriptable;

import com.amazonaws.mturk.service.axis.RequesterService;
import com.amazonaws.mturk.util.ClientConfig;

import edu.mit.csail.uid.turkit.util.U;

public class TurKit {
	/**
	 * The version number for this release of TurKit.
	 */
	public String version = null;

	/**
	 * A reference to the current JavaScript file being executed.
	 */
	public File jsFile;

	/**
	 * A reference to the {@link JavaScriptBobble} associated with this TurKit program.
	 */
	public JavaScriptBobble bobble;

	/**
	 * A reference to a RequesterService--part of the MTurk Java API.
	 */
	public RequesterService requesterService;

	/**
	 * True iff we are using the MTurk sandbox.
	 */
	public boolean sandbox = false;

	/**
	 * True iff we want to see verbose output from the TurKit program.
	 */
	public boolean verbose = true;

	/**
	 * True iff the safety values {@link TurKit#maxMoney} and {@link TurKit#maxHITs} should be used.
	 */
	public boolean safety = true;

	/**
	 * TurKit will try to ensure that no more money than this is spend over <i>all</i> runs of the program.
	 */
	public double maxMoney = 10;

	/**
	 * TurKit will try to ensure that no more than this many HITs will be created over <i>all</i> runs of the program.
	 */
	public int maxHITs = 100;

	/**
	 * True if the TurKit program threw the "stop" exception by calling <code>stop()</code> on the most recent run of the program.
	 */
	public boolean stopped = false;

	/**
	 * This is the main entry point for creating a TurKit program.
	 * @param jsFile a file on disk with the TurKit program, written in JavaScript, using the TurKit JavaScript API.
	 * @param accessKeyId your Amazon AWS access key id.
	 * @param secretKey your Amazon AWS secret key.
	 * @param sandbox set to true to use the sandbox, where you won't spend any real money.
	 * @throws Exception
	 */
	public TurKit(File jsFile, String accessKeyId, String secretKey,
			boolean sandbox) throws Exception {
		ClientConfig conf = new ClientConfig();
		conf.setAccessKeyId(accessKeyId);
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

	/**
	 * Use this constructor if you have your own ClientConfig object with the Amazon AWS access keys.
	 * @param jsFile a file on disk with the TurKit program (see {@link TurKit#TurKit(File, String, String, boolean)}).
	 * @param conf a ClientConfig object with the necessary information to create a RequesterService.
	 * @throws Exception
	 */
	public TurKit(File jsFile, ClientConfig conf) throws Exception {
		init(jsFile, conf);
	}

	private void init(File jsFile, ClientConfig conf) throws Exception {

		version = U.slurp(this.getClass().getResource(
				"/resources/version.properties"));
		{
			Matcher m = Pattern.compile("=(.*)").matcher(version);
			if (m.find()) {
				version = m.group(1).trim();
			}
		}

		this.jsFile = jsFile;
		resetBobble();
		requesterService = new RequesterService(conf);
		sandbox = conf.getServiceURL().contains("sandbox");
	}

	/**
	 * Deletes the bobble file(s) and creates a new one.
	 */
	public void resetBobble() throws Exception {
		if (bobble != null) {
			bobble.delete();
		}
		bobble = new JavaScriptBobble(new File(jsFile.getAbsolutePath()
				+ ".bobble"),
				new File(jsFile.getAbsolutePath() + ".bobble.tmp"));
	}

	/**
	 * Call this when you are done using this TurKit object. It will release any resources it is using,
	 * including a {@link JavaScriptBobble}.
	 */

	public void close() {
		bobble.close();
	}

	/**
	 * Runs the JavaScript program once.
	 * @param maxMoney if non-zero, sets how much money the JavaScript program may spend (over all it's runs) before throwing a safety exception.
	 * @param maxHITs if non-zero, sets how many HITs the JavaScript program may create (over all it's runs) before throwing a safety exception.
	 * @return true iff no "stop" exceptions were thrown using <code>stop()</code> in the JavaScript program.
	 * @throws Exception
	 */
	public boolean runOnce(double maxMoney, int maxHITs) throws Exception {
		if (maxMoney < 0 && maxHITs < 0) {
			safety = false;
		} else if (maxMoney < 0 || maxHITs < 0) {
			throw new Exception(
					"if maxMoney or maxHITs is 0, then they must both be 0.");
		}
		try {
			Context cx = Context.enter();
			cx.setLanguageVersion(170);
			Scriptable scope = cx.initStandardObjects();

			scope.put("javaTurKit", scope, this);

			{
				URL url = this.getClass().getResource(
						"/resources/js_libs/util.js");
				cx.evaluateReader(scope,
						new InputStreamReader(url.openStream()),
						url.toString(), 1, null);
			}

			{
				URL url = this.getClass().getResource(
						"/resources/js_libs/turkit.js");
				cx.evaluateReader(scope,
						new InputStreamReader(url.openStream()),
						url.toString(), 1, null);
			}

			stopped = false;
			cx.evaluateReader(scope, new FileReader(jsFile), jsFile
					.getAbsolutePath(), 1, null);
		} catch (Exception e) {
			if (e instanceof JavaScriptException) {
				JavaScriptException je = (JavaScriptException) e;
				if (je.details().equals("stop")) {
					if (verbose) {
						System.out.println("stopped");
					}
					return false;
				}
			}
			if (verbose) {
				e.printStackTrace();
			}
			throw e;
		}
		return !stopped;
	}

	/**
	 * Trys to delete all your HITs.
	 * It may fail, but it should print out how many HITs it was able to delete.
	 */
	public void deleteHITs() throws Exception {
		try {
			Context cx = Context.enter();
			cx.setLanguageVersion(170);
			Scriptable scope = cx.initStandardObjects();

			scope.put("javaTurKit", scope, this);

			{
				URL url = this.getClass().getResource(
						"/resources/js_libs/util.js");
				cx.evaluateReader(scope,
						new InputStreamReader(url.openStream()),
						url.toString(), 1, null);
			}

			{
				URL url = this.getClass().getResource(
						"/resources/js_libs/turkit.js");
				cx.evaluateReader(scope,
						new InputStreamReader(url.openStream()),
						url.toString(), 1, null);
			}

			{
				URL url = this.getClass().getResource(
						"/resources/js_libs/deleteHITs.js");
				cx.evaluateReader(scope,
						new InputStreamReader(url.openStream()),
						url.toString(), 1, null);
			}
		} catch (Exception e) {
			e.printStackTrace();
			throw e;
		}
	}

	/**
	 * Calls {@link TurKit#runOnce(double, int)} repeatedly, with a delay of <code>retryAfterSeconds</code> between runs.
	 * @param retryAfterSeconds number of seconds delay between calling {@link TurKit#runOnce(double, int)}.
	 * @param maxMoney see {@link TurKit#runOnce(double, int)}.
	 * @param maxHITs see {@link TurKit#runOnce(double, int)}.
	 * @throws Exception
	 */
	public void run(int retryAfterSeconds, double maxMoney, int maxHITs)
			throws Exception {
		while (true) {
			if (runOnce(maxMoney, maxHITs)) {
				break;
			}
			Thread.sleep(retryAfterSeconds * 1000);
		}
	}
}
