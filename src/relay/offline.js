/**
 * Offline submission queue.
 *
 * A relay finishes a delivery where there is no signal. The photo and the
 * details are written to IndexedDB immediately, and pushed to the server when
 * a connection comes back — so the work is never lost and never has to be
 * redone at the top of a hill.
 *
 * Two rules this file exists to keep:
 *   - Nothing is ever reported as submitted until the server has confirmed it.
 *   - A queued item is retried, not silently dropped, and a permanent failure
 *     is surfaced to the relay rather than swallowed.
 */

const DB_NAME = "a8-relay";
const DB_VERSION = 1;
const STORE = "queue";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("orderId", "orderId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    t.oncomplete = () => resolve(result?.result !== undefined ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** Queue one submission. Returns its local id. */
export async function enqueue(item) {
  return tx("readwrite", (store) => store.add({
    ...item,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  }));
}

export async function listQueue() {
  return tx("readonly", (store) => store.getAll());
}

export async function queuedForOrder(orderId) {
  const all = await listQueue();
  return all.filter((i) => i.orderId === orderId);
}

async function remove(id) {
  return tx("readwrite", (store) => store.delete(id));
}

async function markFailure(id, message, permanent) {
  const all = await listQueue();
  const item = all.find((i) => i.id === id);
  if (!item) return;
  return tx("readwrite", (store) => store.put({
    ...item,
    attempts: item.attempts + 1,
    lastError: message,
    permanent: !!permanent,
  }));
}

/**
 * Attempts every queued item once.
 *
 * `send` does the actual network work for one item and must throw on failure.
 * A 4xx other than 429 means the server rejected the submission on its merits
 * — retrying will not help, so it is marked permanent and kept for the relay
 * to see rather than retried forever.
 */
export async function flushQueue(send, { onProgress } = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sent: 0, failed: 0, skipped: "offline" };
  }

  const items = (await listQueue()).filter((i) => !i.permanent);
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await send(item);
      await remove(item.id);
      sent += 1;
    } catch (err) {
      const status = err?.status ?? 0;
      const permanent = status >= 400 && status < 500 && status !== 429 && status !== 401;
      await markFailure(item.id, err?.message || "Upload failed", permanent);
      failed += 1;
    }
    onProgress?.({ sent, failed, total: items.length });
  }

  return { sent, failed };
}

/** Drop a submission the relay has given up on, so they can start it again. */
export async function discard(id) {
  return remove(id);
}

/** Calls back whenever the browser thinks connectivity changed. */
export function onConnectivityChange(handler) {
  const online = () => handler(true);
  const offline = () => handler(false);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}

export const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;
