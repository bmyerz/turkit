package edu.mit.csail.uid.turkit.gui;

import java.awt.BorderLayout;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.WindowEvent;
import java.awt.event.WindowFocusListener;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;

import javax.swing.JButton;
import javax.swing.JEditorPane;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTextArea;
import javax.swing.Timer;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;

import com.javadocking.DockingManager;
import com.javadocking.dock.Position;
import com.javadocking.dock.SplitDock;
import com.javadocking.dock.TabDock;
import com.javadocking.dockable.DefaultDockable;
import com.javadocking.dockable.Dockable;
import com.javadocking.dockable.DockingMode;
import com.javadocking.model.FloatDockModel;

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
	public boolean inputSaved = true;
	public long jsFile_lastModified = -1;

	public Main(File jsFile, String accessKey, String secretKey,
			boolean sandbox, double maxMoney, int maxHITs) throws Exception {
		this.jsFile = jsFile;

		// create turkit
		turkit = new TurKit(jsFile, accessKey, secretKey, sandbox);
		turkit.maxMoney = maxMoney;
		turkit.maxHITs = maxHITs;

		// create gui
		f = new JFrame();
		f.setTitle("" + jsFile.getName() + "  -  TurKit");
		U.exitOnClose(f);
		f.getContentPane().setLayout(new BorderLayout());

		// toolbar
		JPanel toolbar = new JPanel(new BorderLayout());
		JButton pauseButton = new JButton("Stop");
		pauseButton.addActionListener(new ActionListener() {
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
			public void actionPerformed(ActionEvent e) {
				try {
					onRun();
				} catch (Exception ee) {
					throw new Error(ee);
				}
			}
		});
		runPrompt = new JLabel();
		JButton deleteBobble = new JButton("Delete Bobble");
		deleteBobble.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				try {
					onResetBobble();
				} catch (Exception ee) {
					throw new Error(ee);
				}
			}
		});
		JButton deleteHits = new JButton("Delete HITs");
		deleteHits.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				try {
					onDeleteHITs();
				} catch (Exception ee) {
					throw new Error(ee);
				}
			}
		});
		JPanel toolbarCenter = new JPanel();
		toolbarCenter.add(pauseButton);
		toolbarCenter.add(runButton);
		toolbarCenter.add(runPrompt);
		toolbar.add(toolbarCenter, BorderLayout.WEST);
		JPanel toolbarRight = new JPanel();
		toolbarRight.add(deleteBobble);
		toolbarRight.add(deleteHits);
		toolbar.add(toolbarRight, BorderLayout.EAST);

		f.getContentPane().add(toolbar, BorderLayout.NORTH);

		// dockables
		Font font = new Font(Font.MONOSPACED, Font.PLAIN, 12);
		{
			input = new JEditorPane();
			checkReloadInput();
			input.getDocument().addDocumentListener(new DocumentListener() {
				public void changedUpdate(DocumentEvent arg0) {
					onInputChange();
				}

				public void insertUpdate(DocumentEvent arg0) {
					onInputChange();
				}

				public void removeUpdate(DocumentEvent arg0) {
					onInputChange();
				}
			});
			input.addKeyListener(new KeyListener() {

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

				public void keyReleased(KeyEvent arg0) {
				}

				public void keyTyped(KeyEvent arg0) {
				}
			});
			input.setFont(font);
		}
		{
			output = new JTextArea();
			output.setEditable(false);
			output.setFont(font);
		}
		{
			bobble = new JTextArea();
			bobble.setEditable(false);
			updateBobble();
			bobble.setFont(font);
		}
		Dockable inputDock = new DefaultDockable("input",
				new JScrollPane(input), "input", null, DockingMode.ALL);
		Dockable outputDock = new DefaultDockable("output", new JScrollPane(
				output), "output", null, DockingMode.ALL);
		Dockable bobbleDock = new DefaultDockable("bobble", new JScrollPane(
				bobble), "bobble", null, DockingMode.ALL);

		TabDock leftTabDock = new TabDock();
		TabDock topTabDock = new TabDock();
		TabDock bottomTabDock = new TabDock();
		leftTabDock.addDockable(inputDock, new Position(0));
		topTabDock.addDockable(outputDock, new Position(0));
		bottomTabDock.addDockable(bobbleDock, new Position(0));

		SplitDock leftSplitDock = new SplitDock();
		leftSplitDock.addChildDock(leftTabDock, new Position(Position.CENTER));
		SplitDock topSplitDock = new SplitDock();
		topSplitDock.addChildDock(topTabDock, new Position(Position.CENTER));
		SplitDock bottomSplitDock = new SplitDock();
		bottomSplitDock.addChildDock(bottomTabDock, new Position(
				Position.CENTER));

		FloatDockModel dockModel = new FloatDockModel();
		dockModel.addOwner("frame0", f);
		DockingManager.setDockModel(dockModel);
		dockModel.addRootDock("leftdock", leftSplitDock, f);
		dockModel.addRootDock("topdock", topSplitDock, f);
		dockModel.addRootDock("bottomdock", bottomSplitDock, f);

		JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
		splitPane.setDividerLocation(400);
		JSplitPane rightSplitPane = new JSplitPane(JSplitPane.VERTICAL_SPLIT);
		rightSplitPane.setDividerLocation(300);

		splitPane.setLeftComponent(leftSplitDock);
		splitPane.setRightComponent(rightSplitPane);
		rightSplitPane.setLeftComponent(topSplitDock);
		rightSplitPane.setRightComponent(bottomSplitDock);

		f.getContentPane().add(splitPane, BorderLayout.CENTER);

		f.setSize(800, 600);
		f.setVisible(true);

		{
			Timer filePoller = new Timer(500, new ActionListener() {
				public void actionPerformed(ActionEvent arg0) {
					try {
						checkReloadInput();
					} catch (Exception e) {
						throw new Error(e);
					}
				}
			});
			filePoller.start();
		}

		f.addWindowFocusListener(new WindowFocusListener() {

			public void windowGainedFocus(WindowEvent arg0) {
				try {
					checkReloadInput();
				} catch (Exception e) {
					throw new Error(e);
				}
			}

			public void windowLostFocus(WindowEvent arg0) {
				// TODO Auto-generated method stub

			}
		});
	}

	public void onSaveInput() throws Exception {
		U.saveString(jsFile, input.getText());
		jsFile_lastModified = jsFile.lastModified();
		inputSaved = true;
		updateTitle();
	}

	public void checkReloadInput() throws Exception {
		if (inputSaved) {
			long a = jsFile.lastModified();
			if (a > jsFile_lastModified) {
				onStop();
				onReloadInput();
			}
			jsFile_lastModified = a;
		}
	}

	public void onReloadInput() throws Exception {
		input.setText(U.slurp(jsFile));
		inputSaved = true;
		updateTitle();
	}

	public void onInputChange() {
		onStop();
		inputSaved = false;
		updateTitle();
	}

	public void updateTitle() {
		f.setTitle(jsFile.getName() + (inputSaved ? "" : "*") + "  -  TurKit "
				+ turkit.version);
	}

	public void updateBobble() throws Exception {
		turkit.bobble.consolidate();
		bobble.setText(U.slurp(turkit.bobble.storageFile));
	}

	public void runInABit(long delaySeconds) {
		runAgainAtThisTime = System.currentTimeMillis() + (delaySeconds * 1000);
		updateRunPrompt();
	}

	private class MyOutputStream extends OutputStream {
		ByteArrayOutputStream stream = new ByteArrayOutputStream();
		PrintStream realOut;
		PrintStream realErr;
		PrintStream printStream;

		public MyOutputStream() {
			realOut = System.out;
			realErr = System.err;
			printStream = new PrintStream(this, true);
			System.setOut(printStream);
			System.setErr(printStream);
		}

		@Override
		public void close() {
			printStream.flush();
			printStream.close();
			System.setOut(realOut);
			System.setErr(realErr);
		}

		@Override
		public void flush() {
			output.append(stream.toString());
			output.setCaretPosition(output.getText().length());
			stream = new ByteArrayOutputStream();
		}

		@Override
		public void write(int b) throws IOException {
			stream.write(b);
		}
	}

	public void onRun() throws Exception {
		if (inputSaved) {
			onReloadInput();
		} else {
			onSaveInput();
		}

		output.setText("");
		MyOutputStream scriptOut = new MyOutputStream();
		try {
			turkit.runOnce(10, 100);
		} catch (Exception e) {
			System.out.println("ERROR: ----------------------------------");
			e.printStackTrace();
		}
		scriptOut.close();

		// bobble
		updateBobble();

		runInABit(runDelaySeconds);
	}

	public void onResetBobble() throws Exception {
		onStop();
		turkit.resetBobble();
		updateBobble();
	}

	public void onDeleteHITs() throws Exception {
		onStop();

		output.setText("");
		MyOutputStream scriptOut = new MyOutputStream();
		turkit.deleteHITs();
		scriptOut.close();
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
