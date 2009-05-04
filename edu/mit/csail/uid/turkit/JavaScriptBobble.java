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
	public File storageFile;
	public File tempFile;
	public Context cx;
	public Scriptable scope;
	public PrintWriter storageFileOut;
	public ConsolidationTimer consolidationTimer;

	public JavaScriptBobble(File storageFile, File tempFile) throws Exception {
		this.storageFile = storageFile;
		this.tempFile = tempFile;

		cx = Context.enter();
		cx.setLanguageVersion(170);
		scope = cx.initStandardObjects();

		URL myutil = this.getClass().getResource("/resources/myutil.js");
		cx.evaluateReader(scope, new InputStreamReader(myutil.openStream()),
				myutil.toString(), 1, null);

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

	synchronized public void close() {
		consolidationTimer.close();
	}

	class ConsolidationTimer implements Runnable {
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

	public String getKey(String s) {
		String key = null;
		for (int length = 4;; length++) {
			key = U.getRandomString(length, "0123456789abcdef");
			if (s.indexOf(key) < 0) {
				break;
			}
		}
		return key;
	}

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
