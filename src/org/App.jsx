import { useState } from "react";
import { OrgAuthProvider, useOrgAuth } from "./useOrgAuth";
import { colors, fonts, radius, shadow } from "../theme";
import { Button, Spinner } from "./components";
import Auth from "./screens/Auth";
import Queue from "./screens/Queue";
import Review from "./screens/Review";
import Relays from "./screens/Relays";
import Team from "./screens/Team";

// Dev-only. Vite drops this branch from a production build.
const preview = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get("preview") === "1";
if (preview) {
  const { installFixtures } = await import("../devFixtures");
  installFixtures();
}

const NAV = [
  { key: "queue", label: "Gifts" },
  { key: "relays", label: "Relays" },
  { key: "team", label: "Team" },
];

function Portal() {
  const { profile, signOut } = useOrgAuth();
  const [tab, setTab] = useState("queue");
  const [reviewing, setReviewing] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: colors.page, fontFamily: fonts.ui }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{"*{-webkit-font-smoothing:antialiased}body{margin:0}"}</style>

      <header style={{
        background: colors.surface, borderBottom: `1px solid ${colors.border}`,
        padding: "14px 20px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{
          maxWidth: "900px", margin: "0 auto", display: "flex",
          alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
        }}>
          <div>
            <p style={{
              fontFamily: fonts.display, fontSize: "16px", fontWeight: 700,
              color: colors.text, letterSpacing: "-0.05em", margin: 0,
            }}>
              a8 <span style={{ fontWeight: 500 }}>ameliorate</span>
            </p>
            <p style={{ fontSize: "11.5px", color: colors.textTertiary, margin: "1px 0 0", fontFamily: fonts.ui }}>
              {profile?.org?.name}
              {profile?.org?.location ? ` · ${profile.org.location}` : ""}
            </p>
          </div>

          <nav style={{ display: "flex", gap: "5px", alignItems: "center" }}>
            {NAV.map((n) => {
              const on = tab === n.key && !reviewing;
              return (
                <div
                  key={n.key}
                  onClick={() => { setTab(n.key); setReviewing(null); }}
                  style={{
                    padding: "8px 14px", borderRadius: radius.pill, cursor: "pointer",
                    fontSize: "13px", fontWeight: on ? 700 : 500, fontFamily: fonts.ui,
                    background: on ? colors.surfaceMuted : "transparent",
                    color: on ? colors.text : colors.textSecondary,
                  }}
                >{n.label}</div>
              );
            })}
            <Button variant="quiet" onClick={signOut} style={{ padding: "8px 10px", fontSize: "12.5px" }}>
              Sign out
            </Button>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "26px 20px 60px" }}>
        {reviewing ? (
          <Review
            orderId={reviewing}
            onBack={() => setReviewing(null)}
            onDone={() => { setReviewing(null); setTab("queue"); }}
          />
        ) : tab === "queue" ? (
          <Queue onReview={setReviewing} />
        ) : tab === "relays" ? <Relays /> : <Team />}
      </main>
    </div>
  );
}

function Gate() {
  const { user, profile, loading, noRole, emailVerified } = useOrgAuth();
  if (preview) return <Portal />;
  // An invite arrives as ?invite=TOKEN on this page.
  const inviteToken = new URLSearchParams(window.location.search).get("invite");

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: colors.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner label="Loading" />
      </div>
    );
  }

  if (!user || !emailVerified || noRole || !profile) {
    return <Auth inviteToken={inviteToken} />;
  }

  return <Portal />;
}

export default function App() {
  return (
    <OrgAuthProvider>
      <Gate />
    </OrgAuthProvider>
  );
}
