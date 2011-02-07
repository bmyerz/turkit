package online;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Map;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import util.U;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Key;
import com.google.appengine.api.datastore.Text;
import com.google.appengine.api.quota.QuotaService;
import com.google.appengine.api.quota.QuotaServiceFactory;
import com.google.appengine.api.users.UserService;
import com.google.appengine.api.users.UserServiceFactory;

@SuppressWarnings("serial")
public class ApiServlet extends HttpServlet {

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
			
			resp.setContentType("text/plain");
			PrintWriter out = resp.getWriter();

			UserService userService = UserServiceFactory.getUserService();
			String uri = req.getRequestURI();
			boolean admin = uri.startsWith("/_/");
			if (!userService.isUserLoggedIn() && !admin)
				throw new IllegalArgumentException(
						"must be logged in to use the API");
			Entity user = null;
			if (userService.isUserLoggedIn()) {
				user = Utils.getUser(userService.getCurrentUser().getEmail());
			}

			String method = req.getParameter("method");

			DatastoreService ds = DatastoreServiceFactory.getDatastoreService();

			// make sure they have accepted our warranty
			if (admin && (user == null)) {
				// special case for cron job
			} else if (!U.getBoolean(U.getDef(user
					.getProperty("acceptedWarranty"), false))) {
				throw new IllegalArgumentException(
						"must accept warranty before using API.");
			}

			// methods...
			if (false) {
			} else if (method.equals("createProject")) {

				String fromExample = req.getParameter("fromExample");
				if (fromExample != null && fromExample.length() > 0) {
					out
							.println(Utils.json(Utils.createProjectFromExample(
									req.getParameter("name"), user.getKey(),
									fromExample)));
				} else {
					out.println(Utils.json(Utils.createProject(req
							.getParameter("name"), user.getKey())));
				}

			} else if (method.equals("getProjects")) {
				out
						.println(Utils.json(Utils.getProjects(user.getKey(),
								false)));
			} else if (method.equals("getExampleProjects")) {
				out.println(Utils.json(Utils.getExampleProjects()));

			} else if (method.equals("getUser")) {
				out.println(Utils.json(user));

			} else if (method.equals("setUser")) {
				Utils.set(user.getKey(), "awsId", req.getParameter("awsId"),
						"awsKey", req.getParameter("awsKey"));

			} else if (method.equals("getFile")) {
				// access control
				Entity file = Utils.getEntity(req.getParameter("file"));
				Entity proj = ds.get((Key) file.getProperty("project"));
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: this file is not in one of your projects");
				}

				out.println(Utils.json(file));

			} else if (method.equals("setFileContents")) {
				// access control
				Entity file = Utils.getEntity(req.getParameter("file"));
				Entity proj = ds.get((Key) file.getProperty("project"));
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: this file is not in one of your projects");
				}

				Utils.setFileContents(file.getKey(), req
						.getParameter("contents"));

			} else if (method.equals("setFileTestData")) {
				// access control
				Entity file = Utils.getEntity(req.getParameter("file"));
				Entity proj = ds.get((Key) file.getProperty("project"));
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: this file is not in one of your projects");
				}

				Utils.setFileTestData(file, req.getParameter("data"), "server");

			} else if (method.equals("getFiles")) {
				// make sure this user owns the project
				Entity proj = Utils.getEntity(req.getParameter("project"));
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: you do not own this project");
				}

				out.println(Utils.json(Utils.getFiles(proj.getKey(), false)));

			} else if (method.equals("stop")) {
				// make sure this user owns the project
				Entity proj = Utils.getEntity(req.getParameter("project"));
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: you do not own this project");
				}

				Utils.set(proj.getKey(), "rerun", false);

			} else if (method.equals("rerun")) {
				// make sure this user owns the project
				Entity proj = Utils.getEntity(req.getParameter("project"));
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: you do not own this project");
				}

				Utils.set(proj.getKey(), "rerun", true);
				Utils.run(proj.getKey(), -1, false, Utils.getURLPrefix(req
						.getRequestURL().toString()), true, deadline);

			} else if (method.equals("run")) {
				// make sure this user owns the project
				Entity proj = Utils.getEntity(req.getParameter("project"));
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: you do not own this project");
				}

				Utils.run(proj.getKey(), Integer.parseInt((String) U.getDef(req
						.getParameter("retryMinRunCount"), "-1")), ((String) U
						.getDef(req.getParameter("reset"), "false"))
						.equals("true"), Utils.getURLPrefix(req.getRequestURL()
						.toString()), U.getDef(req.getParameter("checkRerun"),
						"false").equals("true"), deadline);

			} else if (method.equals("createFile")) {
				// make sure this user owns the project
				Entity proj = Utils.getEntity(req.getParameter("project"));
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: you do not own this project");
				}

				Utils.createFile(proj.getKey(), req.getParameter("name"),
						new Text(""), true);

			} else if (method.equals("clone")) {
				Entity proj = null;
				Entity file = null;
				if (req.getParameter("file") != null) {
					file = Utils.getEntity(req.getParameter("file"));
					proj = ds.get((Key) file.getProperty("project"));
				} else {
					proj = Utils.getEntity(req.getParameter("project"));
				}

				// make sure this user owns the project
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: you do not own this project");
				}

				if (file != null) {
					out.println(Utils.json(Utils.cloneFile(file.getKey(), req
							.getParameter("name"))));
				} else {
					out.println(Utils.json(Utils.cloneProject(proj.getKey(),
							req.getParameter("name"), user.getKey())));
				}

			} else if (method.equals("delete")) {
				Entity proj = null;
				Entity file = null;
				if (req.getParameter("file") != null) {
					file = Utils.getEntity(req.getParameter("file"));
					proj = ds.get((Key) file.getProperty("project"));
				} else {
					proj = Utils.getEntity(req.getParameter("project"));
				}

				// make sure this user owns the project
				if (!admin && !user.getKey().equals(proj.getProperty("owner"))) {
					throw new IllegalArgumentException(
							"access denied: you do not own this project");
				}

				if (file != null) {
					Utils.deleteFile(file.getKey());
				} else {
					Utils.deleteProject(proj.getKey());
				}

			} else if (method.equals("rerunAll")) {
				if (!admin) {
					throw new IllegalArgumentException("access denied");
				}

				Utils.rerunAll();

			} else if (method.equals("test")) {
				if (!admin)
					throw new IllegalArgumentException("access denied");

			} else {
				throw new IllegalArgumentException("unknown method: " + method);
			}
		} catch (Exception e) {
			U.rethrow(e);
		}
	}
}
