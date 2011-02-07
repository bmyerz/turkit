package online;

import java.net.URL;
import java.util.ArrayList;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import turkitBridge.TurKit;
import turkitOnline.RhinoUtil;
import util.Profile;
import util.U;

import com.google.appengine.api.datastore.Cursor;
import com.google.appengine.api.datastore.DatastoreFailureException;
import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.FetchOptions;
import com.google.appengine.api.datastore.Key;
import com.google.appengine.api.datastore.KeyFactory;
import com.google.appengine.api.datastore.Query;
import com.google.appengine.api.datastore.QueryResultList;
import com.google.appengine.api.datastore.Text;
import com.google.appengine.api.datastore.Transaction;
import com.google.appengine.api.datastore.Query.FilterOperator;
import com.google.appengine.api.labs.taskqueue.Queue;
import com.google.appengine.api.labs.taskqueue.QueueFactory;
import com.google.appengine.api.labs.taskqueue.TaskOptions;
import com.google.appengine.api.quota.QuotaService;
import com.google.appengine.api.quota.QuotaServiceFactory;

public class Utils {
	public static int maxProjectsPerUser = 100;
	public static int maxFilesPerProject = 100;
	public static int maxPublicURLsPerProject = 1000;
	public static int maxFileSize = 100000;
	public static int maxPublicURLSize = 10000;
	public static int maxPublicURLDataSize = 10000;

	public static String getURLPrefix(String url) {
		Matcher m = Pattern.compile("^[^:]+://[^/]+").matcher(url);
		if (!m.find())
			throw new IllegalArgumentException("invalid url: " + url);
		return m.group(0);
	}

	// usage: set(key, "param1", "value1", "param2", 2, "param3", "value3")
	public static void set(Key key, Object... params) throws Exception {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		while (true) {
			try {
				Transaction t = ds.beginTransaction();
				Entity e = ds.get(t, key);
				for (int i = 0; i < params.length; i += 2) {
					e.setProperty((String) params[i], params[i + 1]);
				}
				ds.put(t, e);
				t.commit();
			} catch (DatastoreFailureException e) {
				continue;
			}
			break;
		}
	}

	public static void registerMTurkNotification(Entity proj, String awsId,
			String awsKey, String mode, String hitId) {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();

		Entity e = new Entity("MTurkNotify");
		e.setProperty("project", proj.getKey());
		e.setProperty("awsId", awsId);
		e.setProperty("awsKey", awsKey);
		e.setProperty("mode", mode);
		e.setProperty("hitId", hitId);
		e.setProperty("lastProcessed", 0);

		ds.put(e);
	}

	public static ArrayList<Entity> getMTurkNotifications(Key projKey,
			boolean keysOnly) {
		Query q = new Query("MTurkNotify");
		q.addFilter("project", FilterOperator.EQUAL, projKey);
		if (keysOnly)
			q.setKeysOnly();
		return getAll(q);
	}

	public static void deleteMTurkNotifications(Key projKey) {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();

		ArrayList<Key> keys = new ArrayList();
		for (Entity e : getMTurkNotifications(projKey, true)) {
			keys.add(e.getKey());
		}

		ds.delete(keys);
	}

	public static void queueRun(Key projKey, long requestTime, boolean reset,
			long countdown) throws Exception {
		Queue q = QueueFactory.getDefaultQueue();
		q.add(TaskOptions.Builder.url("/_/api").param("method", "run").param(
				"project", KeyFactory.keyToString(projKey)).param(
				"requestTime", "" + requestTime).param("reset", "" + reset)
				.param("checkRerun", "true").countdownMillis(countdown));
	}

	public static void rerunAll() throws Exception {
		Query q = new Query("Project");
		q.addFilter("rerun", FilterOperator.EQUAL, true);
		q.setKeysOnly();
		long now = System.currentTimeMillis();
		for (Entity e : getAll(q)) {
			queueRun(e.getKey(), now, false, 0);
		}
	}

	public static void run(final Key projKey, long requestTime, boolean reset,
			String urlPrefix, boolean checkRerun, long deadline) throws Exception {

		// get a lock for running
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Transaction t = ds.beginTransaction();
		Entity proj = ds.get(t, projKey);

		// check rerun status
		if (checkRerun) {
			boolean rerun = U.getBoolean(U.getDef(proj.getProperty("rerun"),
					false));
			if (!rerun) {
				t.commit();
				return;
			}
		}

		long lastRunTime = U.getLong(U.getDef(proj.getProperty("lastRunTime"),
				0));
		long lastStopTime = U.getLong(U.getDef(
				proj.getProperty("lastStopTime"), 0));

		// see if we've run recently enough for this request
		if (requestTime > 0 && lastRunTime >= requestTime) {
			t.commit();
			return;
		}

		// see if it's already running
		if (lastRunTime > lastStopTime) {
			if (System.currentTimeMillis() > lastRunTime + 60 * 1000) {
				if (checkRerun) {
					// it's been "running" a long time,
					// probably something went wrong,
					// and it times out without cleaning up properly...
					// so let's not run now
					t.commit();
					throw new IllegalArgumentException(
							"runaway script -- previous run didn't finish properly");
				} else {
					// if the user is running this explicity,
					// let's go ahead and give it a try
				}
			} else {
				// queue this run for later
				t.commit();
				queueRun(projKey, requestTime, reset, 500);
				throw new IllegalArgumentException("already running");
			}
		}

		if (urlPrefix != null) {
			proj.setProperty("urlPrefix", urlPrefix);
		} else {
			urlPrefix = getString(proj.getProperty("urlPrefix"));
		}

		lastRunTime = System.currentTimeMillis();
		if (lastRunTime <= lastStopTime)
			lastRunTime++;
		proj.setProperty("lastRunTime", lastRunTime);
		ds.put(t, proj);
		t.commit();

		// ok, good, let's run it
		final Entity user = ds.get((Key) proj.getProperty("owner"));

		String source = null;
		if (reset) {
			source = "resetDatabase()";
		} else {
			source = getString(getFile(proj.getKey(), "main.js").getProperty(
					"contents"));
		}

		Entity db = getFile(proj.getKey(), "db");
		Entity props = getFile(proj.getKey(), "props");

		TurKit.ReturnValue a = TurKit.run(getString(user.getProperty("awsId")),
				getString(user.getProperty("awsKey")), "sandbox", 10, 100,
				source, getString(db.getProperty("contents")), getString(props
						.getProperty("contents")), new ExposeToTurKit(proj),
				null, deadline);

		// write output
		Entity output = getFile(proj.getKey(), "output");
		set(output.getKey(), "contents", new Text(a.output));
		set(db.getKey(), "contents", new Text(a.db));

		// extra cleanup when reseting
		if (reset) {
			Utils.deletePublicURLs(proj.getKey());
			Utils.deleteMTurkNotifications(proj.getKey());
		}

		// clean up (release our lock)
		set(projKey, "lastStopTime", System.currentTimeMillis(), "errorCode",
				a.errorCode);
	}

	public static Entity getUser(String name) {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Query q = new Query("User");
		q.addFilter("name", FilterOperator.EQUAL, name);
		Entity e = ds.prepare(q).asSingleEntity();
		if (e == null) {
			e = new Entity("User");
			e.setProperty("name", name);
			e.setProperty("awsId", "change_me");
			e.setProperty("awsKey", "change_me");
			ds.put(e);
		}
		return e;
	}

	public static void setFileContents(Key fileKey, String contents)
			throws Exception {
		if (contents.length() > maxFileSize) {
			throw new IllegalArgumentException("file is too big: "
					+ contents.length() + " bytes out of " + maxFileSize
					+ " bytes max.");
		}

		Utils.set(fileKey, "contents", new Text(contents));
	}

	public static ArrayList<Entity> getPublicURLs(Key projKey, boolean keysOnly) {
		Query q = new Query("PublicURL");
		q.addFilter("project", FilterOperator.EQUAL, projKey);
		if (keysOnly)
			q.setKeysOnly();
		return getAll(q);
	}

	public static String createPublicURL(Entity proj, String contents, String blockWorkers)
			throws Exception {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();

		if (getPublicURLs(proj.getKey(), true).size() >= maxPublicURLsPerProject) {
			throw new IllegalArgumentException("too many public URLs (max is "
					+ maxPublicURLsPerProject + " per project)");
		}

		if (contents.length() > maxPublicURLSize) {
			throw new IllegalArgumentException(
					"public URL content is too big: " + contents.length()
							+ " bytes out of " + maxPublicURLSize
							+ " bytes max.");
		}

		Entity e = new Entity("PublicURL");
		e.setProperty("project", proj.getKey());
		e.setProperty("contents", new Text(contents));
		String spice = U.getRandomString(10);
		e.setProperty("spice", spice);
		if ((blockWorkers != null) && (blockWorkers.length() > 0)) {
			e.setProperty("blockWorkers", blockWorkers);
		}
		ds.put(e);

		return getString(proj.getProperty("urlPrefix")) + "/publicURL/"
				+ KeyFactory.keyToString(e.getKey()) + "/" + spice;
	}

	public static Entity getPublicURL(String publicURL) throws Exception {
		Matcher m = Pattern.compile("/publicURL/([^/]+)/(.*)$").matcher(
				publicURL);
		if (!m.find())
			throw new IllegalArgumentException("invalid public URL: "
					+ publicURL);

		Key urlKey = KeyFactory.stringToKey(m.group(1));
		String spice = m.group(2);

		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Entity e = ds.get(urlKey);

		if (!e.getProperty("spice").equals(spice))
			throw new IllegalArgumentException(
					"corrupt public URL: the spice does not match");

		return e;
	}

	public static String getPublicURLData(String publicURL, String author)
			throws Exception {
		return getPublicURLData(getPublicURL(publicURL), author);
	}

	public static String getPublicURLData(Entity publicURL, String author)
			throws Exception {
		if (getString(publicURL.getProperty("lastDataAuthor"), "").equals(
				author)) {
			return getString(publicURL.getProperty(author + "Data"));
		}
		return null;
	}

	public static void setPublicURLData(String publicURL, String data,
			String author) throws Exception {
		setPublicURLData(getPublicURL(publicURL), data, author);
	}

	public static void setPublicURLData(Entity publicURL, String data,
			String author) throws Exception {
		if (data.length() > maxPublicURLDataSize) {
			throw new IllegalArgumentException("public URL data is too big: "
					+ data.length() + " bytes out of " + maxPublicURLDataSize
					+ " bytes max.");
		}
		set(publicURL.getKey(), author + "Data", new Text(data),
				"lastDataAuthor", author);

		// if the author is the "client", then we want to trigger a re-run of
		// the project
		if (author.equals("client")) {
			queueRun((Key) publicURL.getProperty("project"), System
					.currentTimeMillis(), false, 0);
		}
	}

	public static String getFileTestData(Entity file, String author)
			throws Exception {
		if (getString(file.getProperty("lastTestDataAuthor"), "")
				.equals(author)) {
			return getString(file.getProperty(author + "TestData"));
		}
		return null;
	}

	public static void setFileTestData(Entity file, String data, String author)
			throws Exception {
		if (data.length() > maxPublicURLDataSize) {
			throw new IllegalArgumentException("public URL data is too big: "
					+ data.length() + " bytes out of " + maxPublicURLDataSize
					+ " bytes max.");
		}
		set(file.getKey(), author + "TestData", new Text(data),
				"lastTestDataAuthor", author);
	}

	public static void deletePublicURLs(Key projKey) {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();

		ArrayList<Key> keys = new ArrayList();
		for (Entity e : getPublicURLs(projKey, true)) {
			keys.add(e.getKey());
		}

		ds.delete(keys);
	}

	public static void deletePublicURL(Key projKey, String publicURL)
			throws Exception {
		Matcher m = Pattern.compile("/publicURL/([^/]+)/(.*)$").matcher(
				publicURL);
		if (!m.find())
			throw new IllegalArgumentException("invalid public URL: "
					+ publicURL);

		Key urlKey = KeyFactory.stringToKey(m.group(1));
		String spice = m.group(2);

		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Entity e = ds.get(urlKey);

		if (!e.getProperty("project").equals(projKey))
			throw new IllegalArgumentException(
					"access denied: this project does not own the public URL");

		if (!e.getProperty("spice").equals(spice))
			throw new IllegalArgumentException(
					"corrupt public URL: the spice does not match");

		ds.delete(urlKey);
	}
	
	public static Entity createProjectEntity(String name, Key owner) {
		if (getProjects(owner, true).size() >= maxProjectsPerUser) {
			throw new IllegalArgumentException("too many projects (max is "
					+ maxProjectsPerUser + " per user)");
		}

		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Entity e = new Entity("Project");
		e.setProperty("name", name);
		e.setProperty("owner", owner);
		ds.put(e);
		
		return e;
	}

	public static Entity createProject(String name, Key owner) throws Exception {
		Entity e = createProjectEntity(name, owner);

		createFile(e.getKey(), "main.js", new Text(U.slurp(Utils.class
				.getResource("default_main.js"))), false);
		createFile(e.getKey(), "output", new Text(""), false);
		createFile(e.getKey(), "db", new Text("db = {}"), false);
		createFile(e.getKey(), "props", new Text(U.slurp(Utils.class
				.getResource("default_props.txt"))), false);

		return e;
	}

	public static Entity createProjectFromExample(String name, Key owner, String exampleName) throws Exception {
		Entity e = createProjectEntity(name, owner);

		for (URL u : U.getResourceListing(TurKit.class, "js_examples/" + exampleName)) {
			String filename = U.match(u.getPath(), "/([^/]+)$", 1);
			createFile(e.getKey(), filename, new Text(U.slurp(u)), false);
		}
		
		createFile(e.getKey(), "output", new Text(""), false);
		createFile(e.getKey(), "db", new Text("db = {}"), false);
		createFile(e.getKey(), "props", new Text(U.slurp(Utils.class
				.getResource("default_props.txt"))), false);

		return e;
	}

	public static Entity cloneProject(Key projKey, String newName, Key owner)
			throws Exception {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Entity proj = ds.get(projKey);

		Entity newProj = createProjectEntity(newName, owner);

		for (Entity file : getFiles(projKey, false)) {
			String filename = (String) file.getProperty("name");
			if (filename.equals("db")) {
				createFile(newProj.getKey(), "db", new Text("db = {}"), false);
			} else if (filename.equals("output")) {
				createFile(newProj.getKey(), "output", new Text(""), false);
			} else {
				createFile(newProj.getKey(), filename, (Text) file
						.getProperty("contents"), false);
			}
		}

		return newProj;
	}

	public static Entity cloneFile(Key fileKey, String newName)
			throws Exception {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Entity file = ds.get(fileKey);

		return createFile((Key) file.getProperty("project"), newName,
				(Text) file.getProperty("contents"), true);
	}

	public static void deleteProject(Key projKey) throws Exception {
		ArrayList<Key> keys = new ArrayList<Key>();

		keys.add(projKey);
		for (Entity file : getFiles(projKey, true)) {
			keys.add(file.getKey());
		}

		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		ds.delete(keys);
	}

	public static void deleteFile(Key fileKey) throws Exception {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Entity file = ds.get(fileKey);

		String name = (String) file.getProperty("name");
		if (name.equals("main.js") || name.equals("output")
				|| name.equals("db") || name.equals("props")) {
			throw new IllegalArgumentException(
					"You may not delete the required file: " + name);
		}

		ds.delete(fileKey);
	}

	public static Entity getEntity(String key) throws Exception {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		return ds.get(KeyFactory.stringToKey(key));
	}

	public static Entity getFile(Key proj, String name) {
		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Query q = new Query("File");
		q.addFilter("name", FilterOperator.EQUAL, name);
		q.addFilter("project", FilterOperator.EQUAL, proj);
		return ds.prepare(q).asSingleEntity();
	}

	public static Entity createFile(Key proj, String name, Text contents,
			boolean checkTooMany) {
		if (getFile(proj, name) != null)
			throw new IllegalArgumentException("file already exists: " + name
					+ ", in project: " + proj);

		if (checkTooMany) {
			if (getFiles(proj, true).size() >= maxFilesPerProject) {
				throw new IllegalArgumentException("too many files (max is "
						+ maxFilesPerProject + " per project)");
			}
		}

		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Entity e = new Entity("File");
		e.setProperty("project", proj);
		e.setProperty("name", name);
		e.setProperty("contents", contents);
		ds.put(e);
		return e;
	}

	public static ArrayList<Entity> getProjects(Key owner, boolean keysOnly) {
		Query q = new Query("Project");
		q.addFilter("owner", FilterOperator.EQUAL, owner);
		if (keysOnly)
			q.setKeysOnly();
		return getAll(q);
	}

	public static ArrayList<Entity> getFiles(Key proj, boolean keyOnly) {
		Query q = new Query("File");
		q.addFilter("project", FilterOperator.EQUAL, proj);
		if (keyOnly)
			q.setKeysOnly();
		return getAll(q);
	}

	public static ArrayList<Entity> getAll(Query q) {
		ArrayList<Entity> ret = new ArrayList();

		DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
		Cursor cur = null;
		while (true) {
			QueryResultList<Entity> es = ds.prepare(q).asQueryResultList(
					cur != null ? FetchOptions.Builder.withCursor(cur)
							: FetchOptions.Builder.withLimit(1000));
			if (es.size() == 0)
				break;
			ret.addAll(es);
			cur = es.getCursor();
		}

		return ret;
	}
	
	public static ArrayList getExampleProjects() throws Exception {
		ArrayList a = new ArrayList();
		for (URL u : U.getResourceListing(TurKit.class, TurKit.js_examples_path)) {
			String exampleName = U.match(u.getPath(), "/([^/]+)$", 1);
			a.add(exampleName);
		}
		return a;
	}

	public static String json(Object o) {
		StringBuffer buf = new StringBuffer();
		json(o, buf);
		return buf.toString();
	}

	public static void json(Object o, StringBuffer buf) {
		if (o instanceof String) {
			buf.append("\"");
			buf.append(U.escapeString((String) o));
			buf.append("\"");
		} else if (o instanceof Text) {
			json(((Text) o).getValue(), buf);
		} else if (o instanceof Key) {
			json(KeyFactory.keyToString((Key) o), buf);
		} else if (o instanceof Entity) {
			buf.append("({");

			buf.append("key : ");
			json(((Entity) o).getKey(), buf);

			for (Map.Entry<String, Object> i : ((Entity) o).getProperties()
					.entrySet()) {
				buf.append(",");

				json(i.getKey(), buf);
				buf.append(":");
				json(i.getValue(), buf);
			}

			buf.append("})");
		} else if (o instanceof ArrayList) {
			buf.append("[");
			boolean first = true;
			for (Object oo : (ArrayList) o) {
				if (first) {
					first = false;
				} else {
					buf.append(", ");
				}
				json(oo, buf);
			}
			buf.append("]");
		} else {
			buf.append(o);
		}
	}

	public static String getString(Object o) {
		if (o instanceof Text) {
			return ((Text) o).getValue();
		} else {
			return o.toString();
		}
	}

	public static String getString(Object o, String def) {
		if (o == null)
			return def;
		return getString(o);
	}
}
