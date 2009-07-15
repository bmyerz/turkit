package edu.mit.csail.uid.turkit.gui;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Vector;

import javax.swing.SwingUtilities;
import javax.swing.Timer;

public class SimpleEventManager {
	Vector<SimpleEventListener> listeners = new Vector();

	public SimpleEventManager() {

	}

	public void addListener(SimpleEventListener s) {
		listeners.add(s);
	}

	public SimpleEvent fireEvent(String name, Object a, Object b) {
		return fireEvent(new SimpleEvent(name, a, b));
	}

	public SimpleEvent fireEvent(SimpleEvent e) {
		for (SimpleEventListener lis : listeners) {
			try {
				lis.onEvent(e);
			} catch (Exception ee) {
				throw new Error(ee);
			}
		}
		return e;
	}

	public void pushEvent(String name, Object a, Object b) {
		final SimpleEvent e = new SimpleEvent(name, a, b);
		SwingUtilities.invokeLater(new Runnable() {
			public void run() {
				fireEvent(e);
			}
		});
	}
}
