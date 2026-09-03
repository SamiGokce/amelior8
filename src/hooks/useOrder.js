import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { api } from "../lib/api";
import { useAuth } from "./useAuth";

/**
 * Live subscription to one order. This is what makes the tracking screen
 * advance on its own when ops (or later the GR8 app) moves a stage — no
 * polling, no refresh.
 */
export function useOrder(orderId) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) { setLoading(false); return undefined; }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "orders", orderId),
      (snap) => {
        setOrder(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setError(null);
        setLoading(false);
      },
      (err) => {
        // Most often a rules denial: signed out, or somebody else's order.
        console.error("Order subscription failed:", err);
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [orderId]);

  return { order, loading, error };
}

/** The signed-in donor's own orders, newest first. */
export function useMyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) { setOrders([]); setLoading(false); return undefined; }
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, "orders"),
        where("donorUid", "==", user.uid),
        orderBy("createdAt", "desc"),
      ),
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Orders subscription failed:", err);
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  return { orders, loading, error };
}

/**
 * Active recurring gifts for the signed-in donor.
 *
 * Served through /api rather than a Firestore listener: the security rules
 * keep `subscriptions` server-only, so the donor reads their own through an
 * authenticated endpoint instead.
 */
export function useMySubscriptions() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!user) { setSubscriptions([]); setLoading(false); return () => { alive = false; }; }
    setLoading(true);
    api.listSubscriptions()
      .then((res) => { if (alive) setSubscriptions(res?.subscriptions || []); })
      .catch((err) => {
        console.error("Could not load subscriptions:", err);
        if (alive) setSubscriptions([]);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user, reloadKey]);

  return { subscriptions, loading, reload: () => setReloadKey((k) => k + 1) };
}
