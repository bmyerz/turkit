package edu.mit.csail.uid.turkit.gui;

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.awt.event.WindowFocusListener;
import java.io.File;
import java.util.Map;

import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JMenu;
import javax.swing.JMenuBar;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JSplitPane;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.WindowConstants;
import javax.swing.filechooser.FileFilter;

import com.javadocking.DockingManager;
import com.javadocking.dock.Position;
import com.javadocking.dock.SplitDock;
import com.javadocking.dock.TabDock;
import com.javadocking.dockable.DefaultDockable;
import com.javadocking.dockable.Dockable;
import com.javadocking.dockable.DockingMode;
import com.javadocking.model.FloatDockModel;

import org.apache.commons.cli.*;

import edu.mit.csail.uid.turkit.JavaScriptDatabase;
import edu.mit.csail.uid.turkit.TurKit;
import edu.mit.csail.uid.turkit.util.U;

public class Main implements SimpleEventListener {
	public static JavaScriptDatabase turkitProperties;
	public SimpleEventManager sem;
	public File jsFile;
	public File propertiesFile;
	public JFrame f;
	public TurKit turkit;
	public RunControls runControls;
	public OutputPane outputPane;
	public DatabasePane databasePane;
	public CodePane codePane;
	public PropertiesPane propertiesPane;
	public long runAgainAtThisTime;
	public long runDelaySeconds = 60;
	public Timer timer;
	public Dockable propertiesDock;

	public static void main(String[] args) throws Exception {
		if(args.length > 0) {
			CommandLineInterface cli = new CommandLineInterface();
			cli.run(args);
		} else {
			SwingUtilities.invokeLater(new Runnable() {
				public void run() {
					try {
						new Main();
					} catch (Exception e) {
						U.rethrow(e);
					}
				}
			});
		}
	}

	public Main() throws Exception {

		if (turkitProperties == null) {
			turkitProperties = new JavaScriptDatabase(new File(
					"turkit.properties"), new File("turkit.properties.tmp"));
		}

		JFileChooser chooser = new JFileChooser();
		chooser.setFileFilter(new FileFilter() {
			@Override
			public boolean accept(File f) {
				return f.isDirectory() || f.getName().endsWith(".js");
			}

			@Override
			public String getDescription() {
				return "JavaScript Files";
			}
		});
		{
			String recentFilename = (String) turkitProperties
					.queryRaw("ensure(null, 'recentFile', '')");
			if (!recentFilename.isEmpty()) {
				File f = new File(recentFilename);
				if (f.exists()) {
					chooser.setCurrentDirectory(f);
				} else {
					f = f.getParentFile();
					if (f.exists()) {
						chooser.setCurrentDirectory(f);
					} else {
						chooser.setCurrentDirectory(new File("."));
					}
				}
			} else {
				chooser.setCurrentDirectory(new File("."));
			}
		}
		int returnVal = chooser.showOpenDialog(null);
		if (returnVal == JFileChooser.APPROVE_OPTION) {
			jsFile = chooser.getSelectedFile();
			if (!jsFile.exists()) {
				U.save(jsFile, U.slurp(this.getClass().getResource(
						"default-file-contents.js")));
			}
		} else {
			return;
		}

		sem = new SimpleEventManager();
		sem.addListener(this);

		// properties
		propertiesFile = new File(jsFile.getAbsolutePath() + ".properties");
		String defaultKey = "change_me";
		if (!propertiesFile.exists()) {
			String id = turkitProperties.queryRaw(
					"ensure(null, 'awsAccessKeyID', '" + defaultKey + "')")
					.toString();
			String secret = turkitProperties.queryRaw(
					"ensure(null, 'awsSecretAccessKey', 'change_me_too')")
					.toString();

			U.save(propertiesFile, U.slurp(
					this.getClass().getResource("default.properties"))
					.replaceAll("___ID___", id).replaceAll("___SECRET___",
							secret));
		}
		boolean showPropsPane = false;
		String mode = "offline";
		{
			Map props = PropertiesReader.read(U.slurp(propertiesFile), false);
			if (props != null) {
				mode = ((String) props.get("mode")).toLowerCase();
				if (props.get("awsAccessKeyID").toString().equals(defaultKey)) {
					showPropsPane = true;
				}
			} else {
				showPropsPane = true;
			}
		}

		// create turkit
		turkit = new TurKit(jsFile, "", "", "Offline");

		// create gui
		f = new JFrame();
		U.exitOnClose(f);
		f.setTitle("" + jsFile.getName() + "  -  TurKit");
		f.getContentPane().setLayout(new BorderLayout());

		// menubar
		{
			JMenuBar menubar = new JMenuBar();
			f.setJMenuBar(menubar);
			{
				JMenu m = new JMenu("File");
				menubar.add(m);
				{
					JMenuItem mi = new JMenuItem("Save", 'S');
					m.add(mi);

					mi.addActionListener(new ActionListener() {
						public void actionPerformed(ActionEvent e) {
							sem.fireEvent("save", null, null);
						}
					});
				}
			}
			{
				JMenu m = new JMenu("Tools");
				menubar.add(m);
				{
					JMenuItem mi = new JMenuItem("Delete all sandbox HITs");
					m.add(mi);

					mi.addActionListener(new ActionListener() {
						public void actionPerformed(ActionEvent e) {
							try {
								onDeleteAllHITs("sandbox");
							} catch (Exception ee) {
								U.rethrow(ee);
							}
						}
					});
				}
				{
					JMenuItem mi = new JMenuItem("Delete all real HITs");
					m.add(mi);

					mi.addActionListener(new ActionListener() {
						public void actionPerformed(ActionEvent e) {
							try {
								onDeleteAllHITs("real");
							} catch (Exception ee) {
								U.rethrow(ee);
							}
						}
					});
				}
			}
		}

		// toolbar
		JPanel toolbar = new JPanel(new BorderLayout());
		runControls = new RunControls(sem);
		JButton deleteDatabase = new JButton("Reset Database");
		deleteDatabase.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				try {
					onResetDatabase();
				} catch (Exception ee) {
					U.rethrow(ee);
				}
			}
		});
		JPanel toolbarCenter = new JPanel();
		{
			JComboBox modeDropdown = new JComboBox(new String[] { "offline",
					"sandbox", "real" });
			toolbarCenter.add(modeDropdown);
			modeDropdown.setSelectedIndex(mode.equals("real") ? 2 : mode
					.equals("sandbox") ? 1 : 0);

			modeDropdown.addActionListener(new ActionListener() {
				public void actionPerformed(ActionEvent e) {
					String mode = (String) ((JComboBox) e.getSource())
							.getSelectedItem();
					try {
						propertiesPane.setMode(mode);
					} catch (Exception ee) {
						U.rethrow(ee);
					}
				}
			});
		}
		toolbarCenter.add(runControls);
		toolbar.add(toolbarCenter, BorderLayout.WEST);
		JPanel toolbarRight = new JPanel();
		toolbarRight.add(deleteDatabase);
		toolbar.add(toolbarRight, BorderLayout.EAST);

		f.getContentPane().add(toolbar, BorderLayout.NORTH);

		// dockables
		codePane = new CodePane(sem, jsFile);
		propertiesPane = new PropertiesPane(sem, propertiesFile);
		outputPane = new OutputPane(sem);
		databasePane = new DatabasePane(sem, turkit);
		HITsAndS3Pane hitsAndS3Pane = new HITsAndS3Pane(sem, turkit);

		Dockable codeDock = new DefaultDockable("input", codePane, "input",
				null, DockingMode.ALL);
		propertiesDock = new DefaultDockable("properties", propertiesPane,
				"properties", null, DockingMode.ALL);
		Dockable outputDock = new DefaultDockable("output", outputPane,
				"output", null, DockingMode.ALL);
		Dockable databaseDock = new DefaultDockable("database", databasePane,
				"database", null, DockingMode.ALL);
		Dockable hitsAndS3Dock = new DefaultDockable("HITs / S3",
				hitsAndS3Pane, "HITs / S3", null, DockingMode.ALL);

		TabDock leftTabDock = new TabDock();
		TabDock topTabDock = new TabDock();
		TabDock bottomTabDock = new TabDock();

		if (showPropsPane) {
			leftTabDock.addDockable(codeDock, new Position(0));
			leftTabDock.addDockable(propertiesDock, new Position(1));
		} else {
			leftTabDock.addDockable(propertiesDock, new Position(1));
			leftTabDock.addDockable(codeDock, new Position(0));
		}

		topTabDock.addDockable(outputDock, new Position(0));
		bottomTabDock.addDockable(databaseDock, new Position(1));
		bottomTabDock.addDockable(hitsAndS3Dock, new Position(0));

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
			Timer filePoller = new Timer(1000, new ActionListener() {
				public void actionPerformed(ActionEvent arg0) {
					sem.fireEvent("reload", null, null);
				}
			});
			filePoller.start();
		}

		f.addWindowFocusListener(new WindowFocusListener() {

			public void windowGainedFocus(WindowEvent arg0) {
				sem.fireEvent("reload", null, null);
			}

			public void windowLostFocus(WindowEvent arg0) {
				// TODO Auto-generated method stub

			}
		});

		f.addWindowListener(new WindowAdapter() {
			public void windowClosing(WindowEvent e) {
				if (!(codePane.saved && propertiesPane.saved)) {
					int result = JOptionPane.showConfirmDialog(f,
							"Save before quitting?");
					if (result == JOptionPane.CANCEL_OPTION) {
						f
								.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
						SwingUtilities.invokeLater(new Runnable() {
							public void run() {
								U.exitOnClose(f);
							}
						});
					} else if (result == JOptionPane.YES_OPTION) {
						sem.fireEvent("save", null, null);
					}
				}
			}
		});

		sem.fireEvent("updateDatabase", null, null);
	}

	public void updateTitle() {
		f.setTitle(jsFile.getName()
				+ ((codePane.saved && propertiesPane.saved) ? "" : "*")
				+ "  -  TurKit " + turkit.version);
	}

	public void runInABit(long delaySeconds) {
		runAgainAtThisTime = System.currentTimeMillis() + (delaySeconds * 1000);
		updateRunPrompt();
	}

	public void onEvent(SimpleEvent e) throws Exception {
		if (e.name == "run") {
			onRun();
		} else if (e.name == "stop") {
			onStop();
		} else if (e.name == "save") {
		} else if (e.name == "updateTitle") {
			updateTitle();
		} else if (e.name == "showProperties") {
			showProperties();
		}
	}

	public void showProperties() {
		//propertiesDock.getDock().
	}

	public Map<String, Object> reinitTurKit() throws Exception {
		Map props = PropertiesReader.read(U.slurp(propertiesFile), true);
		if (props == null) {
			turkitProperties.query("recentFile = \""
					+ U.escapeString(jsFile.getAbsolutePath()) + "\"");
			sem.fireEvent("stop", null, null);
			sem.fireEvent("showProperties", null, null);
			throw new Exception("error reading properties");
		}
		String awsAccessKeyID = (String) props.get("awsAccessKeyID");
		String awsSecretAccessKey = (String) props.get("awsSecretAccessKey");
		turkit.reinit(jsFile, awsAccessKeyID, awsSecretAccessKey,
				(String) props.get("mode"));

		turkitProperties.query("awsAccessKeyID = \""
				+ U.escapeString(awsAccessKeyID) + "\";"
				+ "awsSecretAccessKey = \""
				+ U.escapeString(awsSecretAccessKey) + "\";"
				+ "recentFile = \"" + U.escapeString(jsFile.getAbsolutePath())
				+ "\"");

		return props;
	}

	public void onRun() throws Exception {
		sem.fireEvent("save", null, null);

		outputPane.startCapture();
		try {
			Map m = reinitTurKit();
			turkit.runOnce((Double) m.get("maxMoney"), ((Double) m
					.get("maxHITs")).intValue());
		} catch (Exception e) {
			System.out.println("ERROR: ----------------------------------");
			e.printStackTrace();
		} finally {
			outputPane.stopCapture();
		}

		sem.fireEvent("updateDatabase", null, null);

		runInABit(runDelaySeconds);
	}

	public void onResetDatabase() throws Exception {
		sem.fireEvent("stop", null, null);

		outputPane.startCapture();
		try {
			reinitTurKit();
			turkit.resetDatabase(true);
			sem.fireEvent("updateDatabase", null, null);
			System.out
					.println("Done reseting database. (Backup database file created.)");
		} finally {
			outputPane.stopCapture();
		}
	}

	public void onDeleteAllHITs(String mode) throws Exception {
		sem.fireEvent("stop", null, null);

		outputPane.startCapture();
		try {
			reinitTurKit();
			turkit.setMode(mode);
			turkit.deleteAllHITs();
			System.out.println("Done deleting all " + mode + " HITs.");
		} finally {
			outputPane.stopCapture();
		}
	}

	public void onStop() {
		runAgainAtThisTime = -1;
		updateRunPrompt();
	}

	public void updateRunPrompt() {
		if (runAgainAtThisTime < 0) {
			runControls.runPrompt.setText("stopped");
		} else {
			long delta = runAgainAtThisTime - System.currentTimeMillis();
			if (delta <= 0) {
				runControls.runPrompt.setText("about to run again");
			} else {
				runControls.runPrompt
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
								U.rethrow(e);
							}
						}
					});
			timer.setRepeats(false);
			timer.start();
		}
	}
}
