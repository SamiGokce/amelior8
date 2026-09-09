import { useCallback, useEffect, useState } from "react";
import { RelayAuthProvider, useRelayAuth } from "./useRelayAuth";
import { relayApi, sendQueuedItem } from "./api";
import { flushQueue, isOnline, listQueue, onConnectivityChange } from "./offline";
import { colors, fonts, radius } from "../theme";
import { Icon } from "../icons";
import SignIn from "./screens/SignIn";
import Jobs from "./screens/Jobs";
import Job from "./screens/Job";

// Dev-only. Vite drops this branch from a production build.
const preview = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get("preview") === "1";
if (preview) {
  const { installFixtures } = await import("../devFixtures");
  installFixtures();
}

function Loading() {
  return (
    <div style={{
      minHeight: "100vh", background: colors.page, display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: fonts.ui,
    }}>
      <div style={{
        width: "26px", height: "26px", borderRadius: "50%",
        border: `2px solid ${colors.divider}`, borderTopColor: colors.charcoal,
        animation: "a8spin 0.8s linear infinite",
      }} />
      <style>{"@keyframes a8spin{to{transform:rotate(360deg)}}body{margin:0}"}</style>
    </div>
  );
}

function Shell() {
  const { relay, org, signOut } = useRelayAuth();

  const [data, setData] = useState(null);
  const [queue, setQueue] = useState([]);
  const [openJob, setOpenJob] = useState(null);
  const [online, setOnline] = useState(isOnline());
  const [error, setError] = useState(null);
  const [flushing, setFlushing] = useState(false);

  const refreshQueue = useCallback(async () => {
    try { setQueue(await listQueue()); } catch { /* storage unavailable */ }
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await relayApi.jobs());
      setError(null);
    } catch (err) {
      // Offline with a cached view is fine; offline with nothing is not.
      if (!err?.isTransient) setError(err.message);
    }
    await refreshQueue();
  }, [refreshQueue]);

  // Push anything waiting, then reload. Runs on start and whenever the
  // connection comes back.
  const sync = useCallback(async () => {
    if (!isOnline()) return;
    setFlushing(true);
    try {
      await flushQueue(sendQueuedItem);
    } finally {
      setFlushing(false);
      await load();
    }
  }, [load]);

  useEffect(() => { load().then(sync); }, [load, sync]);

  useEffect(() => onConnectivityChange((up) => {
    setOnline(up);
    if (up) sync();
  }), [sync]);

  const queueByOrder = queue.reduce((acc, item) => {
    (acc[item.orderId] ||= []).push(item);
    return acc;
  }, {});

  const pendingCount = queue.filter((q) => !q.permanent).length;

  // Keep the open job in step with reloaded data.
  const current = openJob
    ? [...(data?.open || []), ...(data?.awaitingReview || [])].find((j) => j.id === openJob.id) || openJob
    : null;

  return (
    <div style={{ minHeight: "100vh", background: colors.page, fontFamily: fonts.ui }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{"body{margin:0}*{-webkit-font-smoothing:antialiased}"}</style>

      <header style={{
        background: colors.surface, borderBottom: `1px solid ${colors.border}`,
        padding: "16px 22px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "15.5px", fontWeight: 700, color: colors.text, margin: 0, fontFamily: fonts.ui }}>
              {relay?.name}
            </p>
            <p style={{ fontSize: "12px", color: colors.textTertiary, margin: "1px 0 0" }}>
              {org?.name}
            </p>
          </div>
          <span onClick={signOut} style={{ fontSize: "13px", color: colors.textSecondary, cursor: "pointer" }}>
            Sign out
          </span>
        </div>
      </header>

      {/* Connectivity is stated plainly — a relay must never be left guessing
          whether their work has actually been sent. */}
      {(!online || pendingCount > 0) && (
        <div style={{
          background: online ? "rgba(204, 86, 2, 0.10)" : colors.surfaceSunken,
          padding: "11px 22px",
        }}>
          <p style={{
            fontSize: "12.5px", margin: 0, fontWeight: 600, lineHeight: 1.45,
            color: online ? "#A34602" : colors.textSecondary,
          }}>
            {!online
              ? "No signal. You can keep working — everything saves on your phone."
              : flushing
                ? `Sending ${pendingCount} saved ${pendingCount === 1 ? "item" : "items"}...`
                : `${pendingCount} saved ${pendingCount === 1 ? "item" : "items"} waiting to send.`}
          </p>
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(224, 67, 59, 0.10)", padding: "11px 22px" }}>
          <p style={{ fontSize: "12.5px", color: "#B03028", margin: 0, fontWeight: 600 }}>{error}</p>
        </div>
      )}

      {!data ? <Loading /> : current ? (
        <Job
          job={current}
          queued={queueByOrder[current.id]}
          onBack={() => setOpenJob(null)}
          onChanged={() => { load(); refreshQueue(); }}
        />
      ) : (
        <Jobs data={data} queueByOrder={queueByOrder} onOpen={setOpenJob} />
      )}
    </div>
  );
}

function Gate() {
  const { user, profile, loading, blocked } = useRelayAuth();
  if (preview) return <Shell />;
  if (loading) return <Loading />;
  if (!user || blocked || !profile) return <SignIn />;
  return <Shell />;
}

export default function App() {
  return (
    <RelayAuthProvider>
      <Gate />
    </RelayAuthProvider>
  );
}
