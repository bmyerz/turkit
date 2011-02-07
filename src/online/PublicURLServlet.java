package online;

import java.io.IOException;
import java.io.PrintWriter;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import util.U;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Key;
import com.google.appengine.api.datastore.KeyFactory;
import com.google.appengine.api.datastore.Text;
import com.google.appengine.api.users.UserService;
import com.google.appengine.api.users.UserServiceFactory;

@SuppressWarnings("serial")
public class PublicURLServlet extends HttpServlet {

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
			PrintWriter out = resp.getWriter();

			Entity e = Utils.getPublicURL(req.getRequestURI());

			// block workers
			String workerId = req.getParameter("workerId");
			if (workerId != null) {
				String blockWorkers = Utils.getString(e
						.getProperty("blockWorkers"));
				if (blockWorkers != null) {
					if (blockWorkers.contains(workerId)) {
						out.print(U.slurp(this.getClass().getResource(
								"/turkit/block-turker.html")));
						return;
					}
				}
			}

			if (req.getParameter("getData") != null) {
				resp.setContentType("text/plain");
				String s = Utils.getPublicURLData(e, "server");
				if (s != null)
					out.print(s);
				return;
			} else if (req.getParameter("setData") != null) {
				Utils
						.setPublicURLData(e, req.getParameter("setData"),
								"client");
				return;
			} else {
				Text contents = (Text) e.getProperty("contents");
				if (contents != null) {
					String s = Utils.getString(contents);

					String ip = req.getRemoteAddr();
					int seed = (ip + KeyFactory.keyToString(e.getKey())).hashCode();
					s = s.replace("<%=ip%>", req.getRemoteAddr()).replace(
							"<%=seed%>", "" + seed);

					resp.setContentType("text/html");
					out.print(s);
					return;
				}
			}

			throw new IllegalArgumentException(
					"not sure how to display this URL");
		} catch (Exception e) {
			U.rethrow(e);
		}
	}
}
