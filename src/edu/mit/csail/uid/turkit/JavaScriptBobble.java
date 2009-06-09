package edu.mit.csail.uid.turkit;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.mozilla.javascript.Context;
import org.mozilla.javascript.Scriptable;

import edu.mit.csail.uid.turkit.util.U;

public class JavaScriptBobble {
	/**
	 * The file used to store all the bobble's data.
	 * This data takes the form of JavaScript which can be evaluated to re-create the state of the JavaScript environment in the bobble.
	 */
	public File storageFile;
	private File tempFile;
	private Context cx;
	private Scriptable scope;
	private PrintWriter storageFileOut;
	private ConsolidationTimer consolidationTimer;

	/**
	 * Creates a JavaScript Bobble using the given <code>storageFile</code>.
	 * The <code>tempFile</code> is used as a swap file, and may, under obscure certain conditions,
	 * be the only living version of the data.
	 * If this happens, the data will be loaded from the <code>tempFile</code> the next time this constructor is called.
	 * @param storageFile
	 * @param tempFile
	 * @throws Exception
	 */
	public JavaScriptBobble(File storageFile, File tempFile) throws Exception {
		this.storageFile = storageFile;
		this.tempFile = tempFile;

		cx = Context.enter();
		cx.setLanguageVersion(170);
		scope = cx.initStandardObjects();

		URL util = this.getClass().getResource("/resources/js_libs/util.js");
		cx.evaluateReader(scope, new InputStreamReader(util.openStream()),
				util.toString(), 1, null);

		if (!storageFile.exists() && tempFile.exists()) {
			tempFile.renameTo(storageFile);
		}
		if (storageFile.exists()) {
			// check for any errors in the file
			String s = U.slurp(storageFile);
			String rest = s;
			int goodUntil = 0;
			int entryCount = 0;
			while (true) {
				Matcher m = Pattern.compile("^// begin:(\\w+)\r?\n").matcher(
						rest);
				if (m.find()) {
					String key = m.group(1);
					m = Pattern.compile("(?m)^// end:" + key + "\r?\n")
							.matcher(rest);
					if (m.find()) {
						entryCount++;
						goodUntil += m.end();
						rest = rest.substring(m.end());
					} else {
						break;
					}
				} else {
					break;
				}
			}

			s = s.substring(0, goodUntil);
			cx.evaluateString(scope, s, storageFile.getAbsolutePath(), 1, null);

			// save a copy of the storage file if it is corrupt
			if (goodUntil < s.length()) {
				U.copyFile(storageFile, new File(storageFile.getAbsolutePath()
						+ ".corrupt."
						+ U.getRandomString(10, "01234567890abcdef")));
			}

			if ((entryCount > 1) || (goodUntil < s.length())) {
				consolidate();
			}
		}
		consolidationTimer = new ConsolidationTimer();
	}

	/**
	 * Releases resources associated with the JavaScript Bobble.
	 * In particular, it releases a thread--failure to call <code>close</code>
	 * may result in your program continuing to run after your main method has ended.
	 */
	synchronized public void close() {
		consolidationTimer.close();
	}

	private class ConsolidationTimer implements Runnable {
		public long movingSaveTime = 0;
		public long staticSaveTime = 0;
		public long staticSaveTime_delta = 60 * 1000;
		public long movingSaveTime_delta = 10 * 1000;
		public Thread thread;

		public ConsolidationTimer() {
		}

		synchronized public void onQuery() {
			if ((thread != null) && !thread.isInterrupted()) {
				long time = System.currentTimeMillis();
				movingSaveTime = time + movingSaveTime_delta;
			} else {
				long time = System.currentTimeMillis();
				staticSaveTime = time + staticSaveTime_delta;
				movingSaveTime = time + movingSaveTime_delta;
				thread = new Thread(this);
				thread.start();
			}
		}

		synchronized public void onConsolidate() {
			close();
		}

		synchronized public void close() {
			if (thread != null) {
				thread.interrupt();
			}
		}

		public void run() {
			try {
				while (true) {
					synchronized (this) {
						if (Thread.interrupted()) {
							thread = null;
							break;
						}

						long currentTime = System.currentTimeMillis();
						long nearestSaveTime = Math.min(movingSaveTime,
								staticSaveTime);
						if (currentTime >= nearestSaveTime) {
							consolidate();
							thread = null;
							break;
						} else {
							wait(nearestSaveTime - currentTime);
						}
					}
				}
			} catch (InterruptedException e) {
			} catch (Exception e) {
				throw new Error(e);
			}
		}
	}

	private String getKey(String s) {
		String key = null;
		for (int length = 4;; length++) {
			key = U.getRandomString(length, "0123456789abcdef");
			if (s.indexOf(key) < 0) {
				break;
			}
		}
		return key;
	}

	/**
	 * Reformat the representation of the bobble on disk to take up less space.
	 * @throws Exception
	 */
	synchronized public void consolidate() throws Exception {
		if (storageFileOut != null) {
			storageFileOut.close();
			storageFileOut = null;
		}

		String s = RhinoJson.json_scope(scope);
		String key = getKey(s);
		U.saveString(tempFile, "// begin:" + key + "\n" + s + "// end:" + key
				+ "\n");
		if (storageFile.exists()) {
			if (!storageFile.delete()) {
				throw new Exception(
						"failed to delete file, is some other program using the file: "
								+ storageFile.getAbsolutePath() + "?");
			}
		}
		tempFile.renameTo(storageFile);

		if (consolidationTimer != null)
			consolidationTimer.onConsolidate();
	}

	/**
	 * Evaluates <code>q</code> in the context of the JavaScript Bobble.
	 * State changes are persisted on disk,
	 * and the result is returned to the user using {@link RhinoJson#json(Object)}.
	 * 
	 * <p>NOTE: Queries are wrapped inside a function body, so a query of the form<br>
	 * <code>var a = 5; return a</code><br>
	 * becomes...<br>
	 * <code>(function(){var a = 5; return a})()</code></p>
	 * @param q
	 * @return
	 * @throws Exception
	 */
	synchronized public String query(String q) throws Exception {
		q = "try{(function(){\n" + q + "\n})()}catch(e){e}\n";
		Object ret = cx.evaluateString(scope, q, "query", 1, null);

		String key = getKey(q);
		if (storageFileOut == null) {
			storageFileOut = new PrintWriter(new FileOutputStream(storageFile,
					true));
		}
		storageFileOut.print("// begin:" + key + "\n" + q + "// end:" + key
				+ "\n");
		storageFileOut.flush();

		if (consolidationTimer != null)
			consolidationTimer.onQuery();

		return RhinoJson.json(ret);
	}
}
