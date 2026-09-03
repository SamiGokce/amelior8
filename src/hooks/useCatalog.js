import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

// The catalog changes rarely, so it's fetched once per session and cached in
// module scope rather than re-read on every navigation.
const cache = { countries: null, partners: null, items: null };

function useCached(key, loader) {
  const [data, setData] = useState(cache[key]);
  const [loading, setLoading] = useState(!cache[key]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    if (cache[key]) {
      setData(cache[key]);
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    loader()
      .then((rows) => {
        cache[key] = rows;
        if (alive) { setData(rows); setError(null); }
      })
      .catch((err) => {
        console.error(`Failed to load ${key}:`, err);
        if (alive) setError(err);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data: data || [], loading, error };
}

export function useCountries() {
  return useCached("countries", async () => {
    const snap = await getDocs(query(collection(db, "countries"), where("active", "==", true)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
  });
}

export function usePartners() {
  return useCached("partners", async () => {
    const snap = await getDocs(query(collection(db, "partners"), where("active", "==", true)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

export function useGiftItems() {
  return useCached("items", async () => {
    const snap = await getDocs(collection(db, "giftItems"));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  });
}

/** Categories are derived from what's actually in the catalog, so an empty
 *  category never renders as a dead end. */
export const CATEGORY_META = {
  education: { label: "Education", icon: "book", color: "#7B5CD6" },
  clothing: { label: "Clothing", icon: "shirt", color: "#3FA46A" },
  food: { label: "Food", icon: "wheat", color: "#CC5602" },
  water: { label: "Clean Water", icon: "droplet", color: "#3B93E0" },
  health: { label: "Medical", icon: "medical", color: "#E0433B" },
};

export function useCategories() {
  const { data: items, loading, error } = useGiftItems();
  const present = new Set(items.map((i) => i.category));
  const categories = Object.entries(CATEGORY_META)
    .filter(([key]) => present.has(key))
    .map(([key, meta]) => ({ key, ...meta }));
  return { categories, loading, error };
}

/** Free-text search across name, description, category and country. */
export function searchItems(items, query, countries = []) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const countryName = (code) =>
    countries.find((c) => c.code === code)?.name?.toLowerCase() || "";
  return items.filter((item) => [
    item.name,
    item.description,
    CATEGORY_META[item.category]?.label,
    countryName(item.countryCode),
  ].filter(Boolean).some((field) => field.toLowerCase().includes(q)));
}

export function useGiftItem(itemId) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!itemId) { setLoading(false); return () => { alive = false; }; }
    setLoading(true);
    getDoc(doc(db, "giftItems", itemId))
      .then((snap) => {
        if (!alive) return;
        setItem(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setError(null);
      })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [itemId]);

  return { item, loading, error };
}
