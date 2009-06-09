package edu.mit.csail.uid.turkit.gui;

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.net.URL;

import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JOptionPane;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;

import org.mozilla.javascript.Context;
import org.mozilla.javascript.JavaScriptException;
import org.mozilla.javascript.Scriptable;

import edu.mit.csail.uid.turkit.util.U;

public class NewWindow {
	public JFrame f;
	public JTextArea input;
	public File propsFile;

	public static void main(String[] args) throws Exception {
		new NewWindow();
	}

	public NewWindow() throws Exception {
		propsFile = new File("turkit.properties");

		f = new JFrame();
		U.exitOnClose(f);
		f.getContentPane().setLayout(new BorderLayout());

		input = new JTextArea();
		if (!propsFile.exists()) {
			input.setText(U.slurp(
					this.getClass().getResource("default-turkit.properties"))
					.replaceAll("\r", ""));
		} else {
			input.setText(U.slurp(propsFile));
		}
		f.getContentPane().add(new JScrollPane(input));

		JButton ok = new JButton("Ok");
		ok.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				try {
					onOk();
				} catch (Exception e) {
					throw new Error(e);
				}
			}
		});
		f.getContentPane().add(ok, BorderLayout.SOUTH);

		f.pack();
		f.setSize(640, (int) (1.1 * f.getHeight()));
		f.setVisible(true);
	}

	public void onOk() throws Exception {
		String props = input.getText();
		U.saveString(propsFile, props);

		Context cx = Context.enter();
		cx.setLanguageVersion(170);
		Scriptable scope = cx.initStandardObjects();

		URL util = this.getClass().getResource("/resources/js_libs/util.js");
		cx.evaluateReader(scope, new InputStreamReader(util.openStream()), util
				.toString(), 1, null);

		scope.put("input", scope, props);
		scope.put("defaultFileContents", scope, U.slurp(this.getClass()
				.getResource("default-file-contents.js")));

		URL js = this.getClass().getResource("NewWindow.js");
		try {
			cx.evaluateReader(scope, new InputStreamReader(js.openStream()), js
					.toString(), 1, null);
			f.setVisible(false);
		} catch (Exception e) {
			if (e instanceof JavaScriptException) {
				JavaScriptException je = (JavaScriptException) e;
				JOptionPane.showMessageDialog(f, je.details());
			} else {
				ByteArrayOutputStream o = new ByteArrayOutputStream();
				PrintStream a = new PrintStream(o);
				e.printStackTrace(a);
				JOptionPane.showMessageDialog(f, o.toString());
			}
		}
	}
}
