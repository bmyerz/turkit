package online;

import java.net.URL;

import turkitBridge.ExposeToJavaScript;
import turkitOnline.MTurk;
import util.U;

import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Key;
import com.google.appengine.api.datastore.Text;

public class ExposeToTurKit extends ExposeToJavaScript {

	public class DontExpose {
		public Entity project;
	}

	DontExpose dontExpose = new DontExpose();

	public ExposeToTurKit(Entity project) {
		dontExpose.project = project;
	}

	public void write(String filename, String s) throws Exception {
		Entity file = Utils.getFile(dontExpose.project.getKey(), filename);
		if (file != null) {
			Utils.set(file.getKey(), "contents", new Text(s));
		} else {
			Utils.createFile(dontExpose.project.getKey(), filename,
					new Text(s), true);
		}
	}

	public String read(String filename) throws Exception {
		if (filename.startsWith("http://") || filename.startsWith("https://")) {
			return U.slurp(new URL(filename));
		} else {
			return Utils.getString(Utils.getFile(dontExpose.project.getKey(),
					filename).getProperty("contents"));
		}
	}

	public String createPublicURL(String contents, String blockWorkers) throws Exception {
		return Utils.createPublicURL(dontExpose.project, contents, blockWorkers);
	}

	public void deletePublicURL(String url) throws Exception {
		Utils.deletePublicURL(dontExpose.project.getKey(), url);
	}

	public void setPublicURLData(String url, String data) throws Exception {
		Utils.setPublicURLData(url, data, "server");
	}

	public String getPublicURLData(String url) throws Exception {
		return Utils.getPublicURLData(url, "client");
	}

	public void registerMTurkNotification(String awsId, String awsKey,
			String mode, String hitId) throws Exception {
		Utils.registerMTurkNotification(dontExpose.project, awsId, awsKey,
				mode, hitId);
	}
}
