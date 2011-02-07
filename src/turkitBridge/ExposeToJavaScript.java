package turkitBridge;

import java.io.PrintWriter;
import java.nio.channels.ClosedByInterruptException;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

import turkitOnline.MTurk;
import turkitOnline.RhinoUtil;
import util.MyStringWriter;
import util.U;

public class ExposeToJavaScript {

	public class DontExpose {
		public MyStringWriter out;
		public int nextOut = 1;
		public Map<Integer, PrintWriter> outs;
		public Random r;
	}

	DontExpose dontExpose = new DontExpose();

	public ExposeToJavaScript() {
		dontExpose.out = new MyStringWriter();
		dontExpose.outs = new HashMap();
		addOut(dontExpose.out);
		dontExpose.r = new Random();
	}

	public int addOut(PrintWriter out) {
		int id = dontExpose.nextOut++;
		dontExpose.outs.put(id, out);
		return id;
	}

	public void print(String s) {
		if (s.length() > 0 && !s.endsWith("\n"))
			s += "\n";
		for (PrintWriter out : dontExpose.outs.values()) {
			out.print(s);
		}
	}

	public int wireTapOpen() {
		return addOut(new MyStringWriter());
	}

	public String wireTapClose(int id) {
		return dontExpose.outs.remove(id).toString();
	}

	public String mTurkRestRequest(String id, String secretKey,
			boolean sandbox, String operation, String... paramsList)
			throws Exception {
		try {
			return MTurk.restRequest(id, secretKey, sandbox, operation,
					paramsList);
		} catch (InterruptedException e) {
			throw new Error("timeout");
		} catch (ClosedByInterruptException e) {
			throw new Error("timeout");
		}
	}

	public void sleep(int millis) throws Exception {
		try {
			Thread.sleep(millis);
		} catch (InterruptedException e) {
			throw new Error("timeout");
		}
	}

	public String md5(String s) throws Exception {
		return U.md5(s);
	}

	public String json(Object o) {
		return RhinoUtil.json(o);
	}

	public String getHITTemplate() throws Exception {
		return U.slurp(ExposeToJavaScript.class
				.getResource("hit-template.html"));
	}

	public double random() {
		return dontExpose.r.nextDouble();
	}

	public void setSeed(long seed) {
		dontExpose.r.setSeed(seed);
	}

	public void write(String filename, String s) throws Exception {
		throw new Exception("not implemented");
	}

	public String read(String filename) throws Exception {
		throw new Exception("not implemented");
	}

	public String createPublicURL(String contents) throws Exception {
		throw new Exception("not implemented");
	}

	public void deletePublicURL(String url) throws Exception {
		throw new Exception("not implemented");
	}

	public void setPublicURLData(String url, String data) throws Exception {
		throw new Exception("not implemented");
	}

	public String getPublicURLData(String url) throws Exception {
		throw new Exception("not implemented");
	}

	public void registerMTurkNotification(String awsId, String awsKey,
			String mode, String hitId) throws Exception {
		throw new Exception("not implemented");
	}

}
