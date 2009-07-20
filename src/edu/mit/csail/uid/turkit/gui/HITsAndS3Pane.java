package edu.mit.csail.uid.turkit.gui;

import java.awt.BorderLayout;
import java.awt.Desktop;

import javax.swing.JEditorPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.event.HyperlinkEvent;
import javax.swing.event.HyperlinkListener;

import edu.mit.csail.uid.turkit.TurKit;
import edu.mit.csail.uid.turkit.util.U;

public class HITsAndS3Pane extends JPanel implements SimpleEventListener {
	SimpleEventManager sem;
	JEditorPane html;
	TurKit turkit;
	public static String getOnlineObjectsJs = null;

	public HITsAndS3Pane(SimpleEventManager _sem, TurKit turkit)
			throws Exception {
		this.sem = _sem;
		sem.addListener(this);

		this.turkit = turkit;

		html = new JEditorPane("text/html", "");
		html.setEditable(false);
		html.addHyperlinkListener(new HyperlinkListener() {
			public void hyperlinkUpdate(HyperlinkEvent e) {
				if (e.getEventType() == HyperlinkEvent.EventType.ACTIVATED) {
					try {
						Desktop.getDesktop().browse(e.getURL().toURI());
					} catch (Exception ee) {
						throw new Error(ee);
					}
				}
			}
		});

		setLayout(new BorderLayout());
		add(new JScrollPane(html));
	}

	public void onEvent(SimpleEvent e) throws Exception {
		if (e.name == "updateDatabase") {
			turkit.database.consolidate();
			if (getOnlineObjectsJs == null) {
				getOnlineObjectsJs = U.slurp(this.getClass().getResource(
						"getOnlineObjects.js"));
			}
			String s = (String) turkit.database.queryRaw(getOnlineObjectsJs);
			html.setText(s);
			html.setCaretPosition(0);
		}
	}
}
