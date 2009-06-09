
package edu.mit.csail.uid.turkit.util;

import java.util.Collections;
import java.util.HashMap;
import java.util.Vector;

// ********* ********* ********* ********* ********* ********* ********* ********* ********* ********* ********* *********

public class Bag<V> extends HashMap<V, Double> {
    
    public Double add(V v, double amount) {
        Double i = get(v);
        if (i == null) {
            i = 0.0;
        }
        i = i + amount;
        put(v, i);
        return i;
    }
    
    public Double add(V v) {
        return add(v, 1);
    }
    
    public Double remove(V v) {
        return add(v, -1);
    }
    
    public Vector<Pair<Double, V>> getPairs() {
        Vector<Pair<Double, V>> pairs = new Vector<Pair<Double, V>>();
        for (V v : keySet()) {
            pairs.add(new Pair<Double, V>(get(v), v));
        }
        return pairs;
    }
    
    public Vector<Pair<Double, V>> getSortedPairs() {
        Vector<Pair<Double, V>> pairs = getPairs();
        Collections.sort(pairs, Collections.reverseOrder());
        return pairs;
    }
}
