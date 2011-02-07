package util;

import java.util.HashMap;
import java.util.Map;

import util.U.ProfileEntry;

public class Profile {

	public static class ProfileEntry {
		public long lastStartTime = -1;

		public long timeAccum = 0;

		public ProfileEntry() {
		}

		public void begin() {
			lastStartTime = System.currentTimeMillis();
		}

		public void end() {
			timeAccum += System.currentTimeMillis() - lastStartTime;
			lastStartTime = -1;
		}

		public double seconds() {
			return (double) timeAccum / 1000.0;
		}

		public String toString() {
			return "(" + lastStartTime + ", " + timeAccum + ")";
		}
	}

	public Map<String, ProfileEntry> profileEntries = null;

	public Bag<String> profileCounts = null;

	public Profile() {
		profileEntries = new HashMap<String, ProfileEntry>();
		profileCounts = new Bag<String>();
	}

	public void profileCount(String tag) {
		profileCounts.add(tag);
	}

	public void profile(String tag) {
		ProfileEntry pe = profileEntries.get(tag);
		if (pe == null) {
			pe = new ProfileEntry();
			profileEntries.put(tag, pe);
		}

		if (pe.lastStartTime < 0) {
			pe.begin();
		} else {
			pe.end();
		}
	}

	public void profileStart(String tag) {
		profileBegin(tag);
	}

	public void profileBegin(String tag) {
		ProfileEntry pe = profileEntries.get(tag);
		if (pe == null) {
			pe = new ProfileEntry();
			profileEntries.put(tag, pe);
		}

		pe.begin();
	}

	public void profileStop(String tag) {
		profileEnd(tag);
	}

	public void profileEnd(String tag) {
		ProfileEntry pe = profileEntries.get(tag);
		if (pe == null) {
			pe = new ProfileEntry();
			profileEntries.put(tag, pe);
		}

		pe.end();
	}

	public void print() {
		for (String tag : profileEntries.keySet()) {
			ProfileEntry pe = profileEntries.get(tag);
			System.out.println(tag + ": " + pe.seconds());
		}
		for (String tag : profileCounts.keySet()) {
			System.out.println(tag + ": " + profileCounts.get(tag));
		}
	}

	public String toString() {
		StringBuffer buf = new StringBuffer();
		for (String tag : profileEntries.keySet()) {
			ProfileEntry pe = profileEntries.get(tag);
			buf.append(tag + ": " + pe.seconds() + "\n");
		}
		return buf.toString();
	}
}
