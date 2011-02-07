package online;

import java.io.IOException;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.appengine.api.datastore.Transaction;
import com.google.appengine.api.labs.taskqueue.Queue;
import com.google.appengine.api.labs.taskqueue.QueueFactory;
import com.google.appengine.api.labs.taskqueue.TaskOptions;

@SuppressWarnings("serial")
public class MainServlet extends HttpServlet {

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
			resp.setContentType("text/plain");

			resp.getWriter().println("hi2!");
			System.out.println("hi2!");
			
			Queue q = QueueFactory.getDefaultQueue();
			q.add(TaskOptions.Builder.url("/online").countdownMillis(5000));

			
			/*
			String s = U.slurp(this.getClass().getResourceAsStream(
					"/resources/test.txt"), "UTF8");
			
			

			String db = "";
			DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
			Query q = new Query("Thing");
			q.addFilter("name", FilterOperator.EQUAL, "db");
			Entity e = ds.prepare(q).asSingleEntity();
			if (e == null) {
				e = new Entity("Thing");
				e.setProperty("name", "db");
				U.setString(e, "contents", "");
			}
			db = U.getString(e, "contents");

			QuotaService qs = QuotaServiceFactory.getQuotaService();
			String[] a = TurKit.run("AKIAIFHDYZKUXXMEKKTQ",
					"P6OXL2Pzt/h2PsgvRpTIo9mwVOYudetUsAH6ebkF", "sandbox", 10,
					100, s, db, System.currentTimeMillis()
							+ (27 * 1000)
							- (long) (qs.convertMegacyclesToCpuSeconds(qs
									.getCpuTimeInMegaCycles()) * 1000));

			resp.getWriter().println("------------------------------------");
			resp.getWriter().println("db before:");
			resp.getWriter().println(db);
			
			resp.getWriter().println("------------------------------------");
			resp.getWriter().println("output:");
			resp.getWriter().println(a[0]);
			
			resp.getWriter().println("------------------------------------");
			resp.getWriter().println("db after:");
			resp.getWriter().println(a[1]);
			
			resp.getWriter().println("------------------------------------");
			resp.getWriter().println("error code:");
			resp.getWriter().println(a[2]);

			U.setString(e, "contents", a[1]);
			ds.put(e);
*/
		} catch (Exception e) {
			e.printStackTrace(resp.getWriter());
		}
	}
}
