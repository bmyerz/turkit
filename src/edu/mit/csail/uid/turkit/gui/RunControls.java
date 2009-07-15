package edu.mit.csail.uid.turkit.gui;

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;

public class RunControls extends JPanel implements SimpleEventListener {
	SimpleEventManager sem;

	public JLabel runPrompt;

	public RunControls(SimpleEventManager _sem) {
		this.sem = _sem;
		sem.addListener(this);

		{
			JButton b = new JButton("Stop");
			b.addActionListener(new ActionListener() {
				public void actionPerformed(ActionEvent e) {
					sem.fireEvent("stop", null, null);
				}
			});
			add(b);
		}
		{
			JButton b = new JButton("Run");
			b.addActionListener(new ActionListener() {
				public void actionPerformed(ActionEvent e) {
					sem.fireEvent("run", null, null);
					sem.fireEvent("stop", null, null);
				}
			});
			add(b);
		}
		{
			JButton b = new JButton("Run Repeatedly");
			b.addActionListener(new ActionListener() {
				public void actionPerformed(ActionEvent e) {
					sem.fireEvent("run", true, null);
				}
			});
			add(b);
		}

		runPrompt = new JLabel();
		add(runPrompt);
	}

	public void onEvent(SimpleEvent e) {
	}
}
