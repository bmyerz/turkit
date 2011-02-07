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
import com.google.appengine.api.datastore.Text;
import com.google.appengine.api.users.User;
import com.google.appengine.api.users.UserService;
import com.google.appengine.api.users.UserServiceFactory;

@SuppressWarnings("serial")
public class EditorServlet extends HttpServlet {

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

			UserService userService = UserServiceFactory.getUserService();
			String uri = req.getRequestURI();
			boolean admin = uri.startsWith("/_/");
			if (!userService.isUserLoggedIn() && !admin) {
				resp.sendRedirect(userService.createLoginURL(req
						.getRequestURI()));
				return;
			}
			Entity user = null;
			if (userService.isUserLoggedIn()) {
				user = Utils.getUser(userService.getCurrentUser().getEmail());
			}

			DatastoreService ds = DatastoreServiceFactory.getDatastoreService();

			boolean acceptedWarranty = U.getBoolean(U.getDef(user
					.getProperty("acceptedWarranty"), false));
			if (req.getParameter("accept") != null) {
				acceptedWarranty = req.getParameter("accept").equals("Agree");
				Utils.set(user.getKey(), "acceptedWarranty", acceptedWarranty);
				if (acceptedWarranty) {
					resp.sendRedirect("/editor");
				} else {
					resp.sendRedirect("/");
					return;
				}
			}
			if (!acceptedWarranty || (req.getParameter("warranty") != null)) {
				resp.setContentType("text/html");
				String html = U.slurp(this.getClass().getResource(
						"warranty.html"));
				out.print(html);
				return;
			}

			if (req.getParameter("file") != null) {
				// access control
				Entity file = Utils.getEntity(req.getParameter("file"));
				Entity proj = ds.get((Key) file.getProperty("project"));
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: this file is not in one of your projects");
				}

				if (req.getParameter("getData") != null) {
					resp.setContentType("text/plain");
					String s = Utils.getFileTestData(file, "server");
					if (s != null)
						out.print(s);
					return;
				} else if (req.getParameter("putData") != null) {
					Utils.setFileTestData(file, req.getParameter("putData"),
							"client");
					return;
				}

				if (req.getParameter("rawView") != null) {
					resp.setContentType("text/html");
					out.print(Utils.getString(file.getProperty("contents")));
					return;
				} else if (req.getParameter("reloadableView") != null) {
					resp.setContentType("text/html");
					String html = U.slurp(
							this.getClass().getResource(
									"reloadable_viewer.html")).replace(
							"___FILE___", U.escapeXML(Utils.json(file)));
					html = html.replace("___COMMON___", U.slurp(this
							.getClass().getResource("common.html")));
					out.print(html);
					return;
				} else if (req.getParameter("dbView") != null) {
					resp.setContentType("text/html");
					String html = U.slurp(
							this.getClass().getResource("db_viewer.html"))
							.replace("___FILE___",
									U.escapeXML(Utils.json(file)));
					html = html.replace("___COMMON___", U.slurp(this
							.getClass().getResource("common.html")));
					out.print(html);
					return;
				} else if (req.getParameter("traceView") != null) {
					resp.setContentType("text/html");
					String html = U.slurp(
							this.getClass().getResource("trace_viewer.html"))
							.replace("___FILE___",
									U.escapeXML(Utils.json(file)));
					html = html.replace("___COMMON___", U.slurp(this
							.getClass().getResource("common.html")));
					out.print(html);
					return;
				} else if (req.getParameter("testDataEditor") != null) {
					resp.setContentType("text/html");
					String html = U.slurp(
							this.getClass().getResource(
									"file_test_data_editor.html")).replace(
							"___FILE___", U.escapeXML(Utils.json(file)));
					html = html.replace("___COMMON___", U.slurp(this
							.getClass().getResource("common.html")));
					out.print(html);
					return;
				} else {
					resp.setContentType("text/html");
					boolean readonly = U.getDef(req.getParameter("readonly"),
							"false").equals("true");
					String html = U.slurp(
							this.getClass().getResource("file_editor.html"))
							.replace("___FILE___",
									U.escapeXML(Utils.json(file))).replace(
									"___READONLY___", "" + readonly);
					html = html.replace("___COMMON___", U.slurp(this
							.getClass().getResource("common.html")));
					out.print(html);
					return;
				}

			} else {
				resp.setContentType("text/html");
				String editorHTML = U.slurp(this.getClass().getResource(
						"editor.html"));
				editorHTML = editorHTML.replace("___COMMON___", U.slurp(this
						.getClass().getResource("common.html")));
				editorHTML = editorHTML.replace("___USER___", Utils.json(user));
				editorHTML = editorHTML.replace("___LOGOUT_URL___", U
						.escapeXML(userService.createLogoutURL(req
								.getRequestURI())));
				out.print(editorHTML);
				return;
			}

		} catch (Exception e) {
			U.rethrow(e);
		}
	}
}
