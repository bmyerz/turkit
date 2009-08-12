package edu.mit.csail.uid.turkit;

import java.io.File;
import java.io.FileReader;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jets3t.service.S3Service;
import org.jets3t.service.impl.rest.httpclient.RestS3Service;
import org.jets3t.service.security.AWSCredentials;
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
	 * Your Amazon AWS Access Key ID
	 */
	public String awsAccessKeyID;

	/**
	 * Your Amazon AWS Secret Access Key
	 */
	public String awsSecretAccessKey;

	/**
	 * A reference to the current JavaScript file being executed.
	 */
	public File jsFile;

	/**
	 * A reference to the {@link JavaScriptDatabase} associated with this TurKit program.
	 */
	public JavaScriptDatabase database;

	/**
	 * A reference to a RequesterService--part of the MTurk Java API.
	 */
	public RequesterService requesterService;

	/**
	 * A reference to an S3Service--part of the JetS3t API
	 */
	public S3Service s3Service;

	/**
	 * This is an HTML template used for created HITs hosted on your S3 account.
	 */
	public String taskTemplate;

	/**
	 * Should be one of the following values: "offline", "sandbox", "real"
	 */
	public String mode;

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
	 * @param mode set to "offline", "sandbox" or "real". ("offline" will not let you access MTurk or S3. "sandbox" will let you access the MTurk sandbox, and the real S3. "real" mode accesses the real MTurk and the real S3.)
	 * @throws Exception
	 */
	public TurKit(File jsFile, String accessKeyId, String secretKey, String mode)
			throws Exception {
		reinit(jsFile, accessKeyId, secretKey, mode);
	}

	/**
	 * Use this constructor if you have your own ClientConfig object with the Amazon AWS access keys.
	 * @param jsFile a file on disk with the TurKit program (see {@link TurKit#TurKit(File, String, String, boolean)}).
	 * @param conf a ClientConfig object with the necessary information to create a RequesterService.
	 * @throws Exception
	 */
	public TurKit(File jsFile, ClientConfig conf) throws Exception {
		reinit(jsFile, conf);
	}

	/**
	 * Use this function if you want to re-initialize certain parameters of the TurKit object.
	 * This function will only have an effect if these values are different from their current values.
	 * @throws Exception
	 */
	public void reinit(File jsFile, String accessKeyId, String secretKey,
			String mode) throws Exception {
		ClientConfig conf = new ClientConfig();
		conf.setAccessKeyId(accessKeyId);
		conf.setSecretAccessKey(secretKey);
		mode = mode.toLowerCase();
		conf
				.setServiceURL(mode.equals("sandbox") ? "http://mechanicalturk.sandbox.amazonaws.com/?Service=AWSMechanicalTurkRequester"
						: mode.equals("real") ? "http://mechanicalturk.amazonaws.com/?Service=AWSMechanicalTurkRequester"
								: "");
		Set<String> retriableErrors = new HashSet();
		retriableErrors.add("Server.ServiceUnavailable");
		conf.setRetriableErrors(retriableErrors);
		conf.setRetryAttempts(10);
		conf.setRetryDelayMillis(1000);
		reinit(jsFile, conf);
	}

	/**
	 * Use this function if you want to re-initialize certain parameters of the TurKit object.
	 * This function will only have an effect if these values are different from their current values.
	 * @throws Exception
	 */
	public void reinit(File jsFile, ClientConfig conf) throws Exception {
		if (version == null) {
			version = U.slurp(this.getClass().getResource(
					"/resources/version.properties"));
			{
				Matcher m = Pattern.compile("=(.*)").matcher(version);
				if (m.find()) {
					version = m.group(1).trim();
				}
			}
		}
		if (taskTemplate == null) {
			taskTemplate = U.slurp(this.getClass().getResource(
					"/resources/task-template.html"));
		}

		String oldAwsAccessKeyID = awsAccessKeyID;
		String oldAwsSecretAccessKey = awsSecretAccessKey;
		String oldMode = mode;
		awsAccessKeyID = conf.getAccessKeyId();
		awsSecretAccessKey = conf.getSecretAccessKey();
		String serviceURL = conf.getServiceURL();
		mode = serviceURL.contains("sandbox") ? "sandbox" : serviceURL
				.contains("mechanicalturk.amazonaws.com") ? "real" : "offline";
		if ((requesterService == null)
				|| (!awsAccessKeyID.equals(oldAwsSecretAccessKey))
				|| (!awsSecretAccessKey.equals(oldAwsSecretAccessKey))
				|| (!mode.equals(oldMode))) {

			if (mode.equals("offline")) {
				requesterService = null;
				s3Service = null;
			} else {
				try {
					requesterService = new RequesterService(conf);
				} catch (Exception e) {
					e.printStackTrace();
				}
				if ((s3Service == null)
						|| (!awsAccessKeyID.equals(oldAwsSecretAccessKey))
						|| (!awsSecretAccessKey.equals(oldAwsSecretAccessKey))) {
					try {
						s3Service = new RestS3Service(new AWSCredentials(conf
								.getAccessKeyId(), conf.getSecretAccessKey()));
					} catch (Exception e) {
					}
				}
			}
		}

		File oldJsFile = this.jsFile;
		this.jsFile = jsFile;
		if (!jsFile.equals(oldJsFile)) {
			if (database != null) {
				database.close();
			}
			database = null;
			loadDatabase();
		}
	}

	/**
	 * Changes the mode. Possible values include "offline", "sandbox" and "real".
	 * <ul>
	 * <li>"offline" will not let you access MTurk or S3.</li>
	 * <li>"sandbox" will let you access the MTurk sandbox, and the real S3.</li>
	 * <li>"real" mode accesses the real MTurk and the real S3.</li>
	 * </ul>
	 */
	public void setMode(String mode) throws Exception {
		reinit(jsFile, awsAccessKeyID, awsSecretAccessKey, mode);
	}

	/**
	 * Performs a REST request on MTurk.
	 * The <code>paramsList</code> must be a sequence of strings of the form a1, b1, a2, b2, a3, b3 ...
	 * Where aN is a parameter name, and bN is the value for that parameter.
	 * Most common parameters have suitable default values, namely: Version, Timestamp, Query, and Signature.
	 * 
	 * This is a wrapper around {@link MTurk#restRequest(String, String, boolean, String, String...)}
	 */
	public String restRequest(String operation, String... paramsList)
			throws Exception {
		if (mode.equals("offline"))
			throw new Exception(
					"You may not make a REST request to MTurk in offline mode.");
		return MTurk.restRequest(awsAccessKeyID, awsSecretAccessKey, mode
				.equals("sandbox"), operation, paramsList);
	}

	/**
	 * Deletes the database file(s) and creates a new one.
	 * @param saveBackup set to true if you want to keep a copy of the database file
	 */
	public void resetDatabase(boolean saveBackup) throws Exception {
		if (database != null) {
			runOnce(0, 0, this.getClass().getResource("resetDatabase.js"));

			database.delete(saveBackup);
			database = null;
		}
		loadDatabase();
	}

	private void loadDatabase() throws Exception {
		database = new JavaScriptDatabase(new File(jsFile.getAbsolutePath()
				+ ".database"), new File(jsFile.getAbsolutePath()
				+ ".database.tmp"));
	}

	/**
	 * Call this when you are done using this TurKit object. It will release any resources it is using,
	 * including a {@link JavaScriptDatabase}.
	 */

	public void close() {
		database.close();
	}

	/**
	 * Runs the JavaScript program in the <code>source</code> once.
	 * The <code>source</code> must be a File or URL.
	 * @param maxMoney if non-zero, sets how much money the JavaScript program may spend (over all it's runs) before throwing a safety exception.
	 * @param maxHITs if non-zero, sets how many HITs the JavaScript program may create (over all it's runs) before throwing a safety exception.
	 * @return true iff no "stop" exceptions were thrown using <code>stop()</code> in the JavaScript program.
	 * @throws Exception
	 */
	public boolean runOnce(double maxMoney, int maxHITs, Object source)
			throws Exception {
		this.maxMoney = maxMoney;
		this.maxHITs = maxHITs;
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

			RhinoUtil.evaluateURL(cx, scope, this.getClass().getResource(
					"js_libs/util.js"));
			RhinoUtil.evaluateURL(cx, scope, this.getClass().getResource(
					"js_libs/turkit_base.js"));
			RhinoUtil.evaluateURL(cx, scope, this.getClass().getResource(
					"js_libs/Database.js"));
			RhinoUtil.evaluateURL(cx, scope, this.getClass().getResource(
					"js_libs/TraceManager.js"));
			RhinoUtil.evaluateURL(cx, scope, this.getClass().getResource(
					"js_libs/MTurk.js"));
			RhinoUtil.evaluateURL(cx, scope, this.getClass().getResource(
					"js_libs/S3.js"));
			RhinoUtil.evaluateURL(cx, scope, this.getClass().getResource(
					"js_libs/highlevel_utils.js"));

			stopped = false;
			if (source instanceof URL) {
				RhinoUtil.evaluateURL(cx, scope, (URL) source);
			} else if (source instanceof File) {
				RhinoUtil.evaluateFile(cx, scope, (File) source);
			}
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
	 * Runs the JavaScript program once.
	 * @param maxMoney if non-zero, sets how much money the JavaScript program may spend (over all it's runs) before throwing a safety exception.
	 * @param maxHITs if non-zero, sets how many HITs the JavaScript program may create (over all it's runs) before throwing a safety exception.
	 * @return true iff no "stop" exceptions were thrown using <code>stop()</code> in the JavaScript program.
	 * @throws Exception
	 */
	public boolean runOnce(double maxMoney, int maxHITs) throws Exception {
		return runOnce(maxMoney, maxHITs, jsFile);
	}

	/**
	 * Delete all your HITs.
	 */
	public void deleteAllHITs() throws Exception {
		URL url = this.getClass().getResource("deleteAllHITs.js");
		runOnce(maxMoney, maxHITs, url);
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
