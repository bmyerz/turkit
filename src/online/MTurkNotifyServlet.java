package online;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashSet;
import java.util.Set;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.mozilla.javascript.Context;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.Undefined;

import turkitBridge.TurKit;
import turkitOnline.RhinoUtil;
import util.U;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Key;
import com.google.appengine.api.datastore.Query;
import com.google.appengine.api.datastore.Query.FilterOperator;

@SuppressWarnings("serial")
public class MTurkNotifyServlet extends HttpServlet {

	public void doPost(HttpServletRequest req, HttpServletResponse resp)
			throws IOException {
		go(req, resp);
	}

	public void doGet(HttpServletRequest req, HttpServletResponse resp)
			throws IOException {
		go(req, resp);
	}

	public void go(HttpServletRequest req, HttpServletResponse resp)
			throws IOException {
		try {
			long deadline = System.currentTimeMillis() + 30 * 1000;
			
			if (req.getParameter("Event.1.HITTypeId") != null) {
				Set<Key> projs = new HashSet();
				for (int i = 1;; i++) {
					String prefix = "Event." + i + ".";

					String hitTypeId = req.getParameter(prefix + "HITTypeId");
					if (hitTypeId == null)
						break;
					String hitId = req.getParameter(prefix + "HITId");

					Query q = new Query("MTurkNotify");
					q.addFilter("hitTypeId", FilterOperator.EQUAL, hitTypeId);
					q.addFilter("hitId", FilterOperator.EQUAL, hitId);
					for (Entity e : Utils.getAll(q)) {
						projs.add((Key) e.getProperty("project"));
					}
				}
				for (Key proj : projs) {
					Utils.queueRun(proj, System.currentTimeMillis(), false, 0);
				}
			} else if (req.getParameter("checkAll") != null) {
				if (!req.getRequestURI().startsWith("/_/"))
					throw new IllegalArgumentException("access denied");

				// work here
				resp.setContentType("text/plain");
				PrintWriter out = resp.getWriter();

				DatastoreService ds = DatastoreServiceFactory
						.getDatastoreService();
				long now = System.currentTimeMillis();

				Context cx = null;
				Scriptable scope = null;
				Set<String> cached = new HashSet();

				Set<Key> queued = new HashSet();

				String source = U.slurp(this.getClass().getResource(
						"MTurkNotifyServlet.js"));

				while (true) {
					Query q = new Query("MTurkNotify");
					q.addSort("lastProcessed");
					Iterable<Entity> it = ds.prepare(q).asIterable();
					if (!it.iterator().hasNext())
						return;
					for (Entity e : it) {
						long time = U.getLong(e.getProperty("lastProcessed"));
						if (time >= now)
							return;

						String cacheKey = (String) e.getProperty("awsId") + ":"
								+ (String) e.getProperty("awsKey") + ":"
								+ (String) e.getProperty("mode");
						if (cached.add(cacheKey)) {
							TurKit.ReturnValue a = TurKit.run((String) e
									.getProperty("awsId"), (String) e
									.getProperty("awsKey"), (String) e
									.getProperty("mode"), Double.MAX_VALUE,
									Integer.MAX_VALUE, source, "", "", null,
									scope, deadline);
							cx = a.cx;
							scope = a.scope;
						}

						if (RhinoUtil.evaluateString(cx, scope, "hits['"
								+ e.getProperty("hitId") + "']", "test") instanceof Undefined) {
							e.setProperty("lastProcessed", now);
							ds.put(e);
						} else {
							if (queued.add((Key) e.getProperty("project"))) {
								Utils.queueRun((Key) e.getProperty("project"),
										System.currentTimeMillis(), false, 0);
							}
							ds.delete(e.getKey());
						}
					}
				}
			} else {
				throw new IllegalArgumentException("unknown command");
			}
		} catch (Exception e) {
			U.rethrow(e);
		}
	}
}
