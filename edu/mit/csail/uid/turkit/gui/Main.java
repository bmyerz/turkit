package edu.mit.csail.uid.turkit.gui;

import java.awt.BorderLayout;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.PrintStream;

import javax.swing.JButton;
import javax.swing.JEditorPane;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JTextArea;
import javax.swing.Timer;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;

import edu.mit.csail.uid.turkit.TurKit;
import edu.mit.csail.uid.turkit.util.U;

public class Main {
	public JFrame f;
	public File jsFile;
	public TurKit turkit;
	public JTextArea output;
	public JTextArea bobble;
	public JEditorPane input;
	public JLabel runPrompt;
	public long runAgainAtThisTime;
	public long runDelaySeconds = 60;
	public Timer timer;
	public JTabbedPane tabs;
	public boolean inputSaved = true;

	public Main(File jsFile, String accessKey, String secretKey,
			boolean sandbox, double maxMoney, int maxHits) throws Exception {
		this.jsFile = jsFile;

		// create turkit
		turkit = new TurKit(jsFile, accessKey, secretKey, sandbox);
		turkit.maxMoney = maxMoney;
		turkit.maxHits = maxHits;

		// create gui
		f = new JFrame();
		f.setTitle("" + jsFile.getName() + "  -  TurKit");
		U.exitOnClose(f);
		f.getContentPane().setLayout(new BorderLayout());

		// toolbar
		JPanel toolbar = new JPanel();
		JButton pauseButton = new JButton("Stop");
		pauseButton.addActionListener(new ActionListener() {
			@Override
			public void actionPerformed(ActionEvent e) {
				try {
					onStop();
				} catch (Exception ee) {
					throw new Error(ee);
				}
			}
		});
		JButton runButton = new JButton("Run");
		runButton.addActionListener(new ActionListener() {
			@Override
			public void actionPerformed(ActionEvent e) {
				try {
					onRun();
				} catch (Exception ee) {
					throw new Error(ee);
				}
			}
		});
		runPrompt = new JLabel();
		toolbar.add(pauseButton);
		toolbar.add(runButton);
		toolbar.add(runPrompt);

		JPanel toolbarWrapper = new JPanel(new BorderLayout());
		toolbarWrapper.add(toolbar, BorderLayout.WEST);
		f.getContentPane().add(toolbarWrapper, BorderLayout.NORTH);

		// tabs
		tabs = new JTabbedPane();
		Font font = new Font(Font.MONOSPACED, Font.PLAIN, 12);
		{
			input = new JEditorPane();
			input.setText(U.slurp(jsFile));
			tabs.addTab("input", new JScrollPane(input));
			input.getDocument().addDocumentListener(new DocumentListener() {
				@Override
				public void changedUpdate(DocumentEvent arg0) {
					onInputChange();
				}

				@Override
				public void insertUpdate(DocumentEvent arg0) {
					onInputChange();
				}

				@Override
				public void removeUpdate(DocumentEvent arg0) {
					onInputChange();
				}
			});
			input.addKeyListener(new KeyListener() {

				@Override
				public void keyPressed(KeyEvent ke) {
					// TODO Auto-generated method stub
					if (ke.isControlDown()
							&& (ke.getKeyCode() == KeyEvent.VK_S)) {
						try {
							onSaveInput();
						} catch (Exception e) {
							throw new Error(e);
						}
					}
				}

				@Override
				public void keyReleased(KeyEvent arg0) {
				}

				@Override
				public void keyTyped(KeyEvent arg0) {
				}
			});
			input.setFont(font);
		}
		{
			output = new JTextArea();
			output.setEditable(false);
			tabs.addTab("output", new JScrollPane(output));
			output.setFont(font);
		}
		{
			bobble = new JTextArea();
			bobble.setEditable(false);
			tabs.addTab("bobble", new JScrollPane(bobble));
			updateBobble();
			bobble.setFont(font);
		}

		f.getContentPane().add(tabs, BorderLayout.CENTER);

		f.setSize(600, 400);
		f.setVisible(true);

		runInABit(2);
	}

	public void onSaveInput() throws Exception {
		U.saveString(jsFile, input.getText());
		inputSaved = true;
		updateTitle();
	}

	public void onReloadInput() throws Exception {
		input.setText(U.slurp(jsFile));
		inputSaved = true;
		updateTitle();
	}

	public void onInputChange() {
		inputSaved = false;
		updateTitle();
	}

	public void updateTitle() {
		f.setTitle(jsFile.getName() + (inputSaved ? "" : "*") + "  -  TurKit "
				+ turkit.version);
	}

	public void updateBobble() throws Exception {
		turkit.jsBobble.consolidate();
		bobble.setText(U.slurp(turkit.jsBobble.storageFile));
	}

	public void runInABit(long delaySeconds) {
		runAgainAtThisTime = System.currentTimeMillis() + (delaySeconds * 1000);
		updateRunPrompt();
	}

	public void onRun() throws Exception {
		if (inputSaved) {
			onReloadInput();
		} else {
			onSaveInput();
		}

		PrintStream realOut = System.out;
		PrintStream realErr = System.err;
		ByteArrayOutputStream scriptOut = new ByteArrayOutputStream();
		PrintStream scriptOutStream = new PrintStream(scriptOut, true);
		System.setOut(scriptOutStream);
		System.setErr(scriptOutStream);
		try {
			turkit.runOnce(10, 100);
		} catch (Exception e) {
			System.out.println("ERROR: ----------------------------------");
			e.printStackTrace();
		}
		System.setOut(realOut);
		System.setErr(realErr);
		output.setText(scriptOut.toString());
		output.setCaretPosition(output.getText().length());
		tabs.setSelectedIndex(1);

		// bobble
		updateBobble();

		runInABit(runDelaySeconds);
	}

	public void onStop() {
		runAgainAtThisTime = -1;
		updateRunPrompt();
	}

	public void updateRunPrompt() {
		if (runAgainAtThisTime < 0) {
			runPrompt.setText("stopped");
		} else {
			long delta = runAgainAtThisTime - System.currentTimeMillis();
			if (delta <= 0) {
				runPrompt.setText("about to run again");
			} else {
				runPrompt
						.setText("will run again in "
								+ U.printf("%1.0f", (double) delta / 1000)
								+ " seconds");
			}
			if (timer != null) {
				timer.stop();
			}
			timer = new Timer((int) Math.min(delta, 1000),
					new ActionListener() {
						@Override
						public void actionPerformed(ActionEvent arg0) {
							try {
								if (runAgainAtThisTime < 0) {
									updateRunPrompt();
								} else {
									long delta = runAgainAtThisTime
											- System.currentTimeMillis();
									if (delta <= 0) {
										onRun();
									} else {
										updateRunPrompt();
									}
								}
							} catch (Exception e) {
								throw new Error(e);
							}
						}
					});
			timer.setRepeats(false);
			timer.start();
		}
	}
}
