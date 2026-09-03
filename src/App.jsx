import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { colors, fonts } from "./theme";
import { renderIcon } from "./icons";
import { Loading } from "./components/States";

import Home from "./screens/Home";
import Categories from "./screens/Categories";
import Countries from "./screens/Countries";
import GiftList from "./screens/GiftList";
import GiftDetail from "./screens/GiftDetail";
import CheckoutSuccess from "./screens/CheckoutSuccess";
import Tracking from "./screens/Tracking";
import Orders from "./screens/Orders";
import Profile from "./screens/Profile";
import SignIn from "./screens/SignIn";
import SignUp from "./screens/SignUp";
import ForgotPassword from "./screens/ForgotPassword";
import VerifyEmail from "./screens/VerifyEmail";

// Phone shell — moved from Amelior8App.jsx, styling unchanged.
const NAV_TABS = [
  { icon: "home", label: "Home", path: "/" },
  { icon: "heart", label: "Give", path: "/give" },
  { icon: "barChart", label: "Impact", path: "/orders" },
  { icon: "user", label: "Profile", path: "/profile" },
];

function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div style={{
      display: "flex", justifyContent: "space-around", padding: "6px 0 22px",
      borderTop: `1px solid ${colors.divider}`,
      background: "rgba(240, 235, 225, 0.7)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      flexShrink: 0,
    }}>
      {NAV_TABS.map((tab) => {
        const isActive = tab.path === "/"
          ? pathname === "/"
          : pathname.startsWith(tab.path);
        return (
          <div key={tab.path} onClick={() => navigate(tab.path)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            cursor: "pointer", padding: "4px 12px",
          }}>
            {renderIcon(tab.icon, 20, isActive ? colors.text : colors.textTertiary)}
            <span style={{
              fontSize: "10px", fontWeight: 600, fontFamily: fonts.caption,
              color: isActive ? colors.text : colors.textTertiary,
            }}>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Signed-in and email-verified, or you don't get to the giving flow. */
function RequireAuth({ children, requireVerified = true }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Loading" />;
  if (!user) return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  if (requireVerified && !user.emailVerified) return <Navigate to="/verify-email" replace />;
  return children;
}

function Shell() {
  const { pathname } = useLocation();
  const hideNav = ["/signin", "/signup", "/forgot-password", "/verify-email"]
    .some((p) => pathname.startsWith(p));

  return (
    <div style={{
      minHeight: "100vh",
      background: `
        radial-gradient(ellipse at 15% 30%, rgba(122, 154, 148, 0.2), transparent 55%),
        radial-gradient(ellipse at 85% 15%, rgba(204, 86, 2, 0.08), transparent 50%),
        radial-gradient(ellipse at 35% 80%, rgba(107, 107, 82, 0.12), transparent 50%),
        radial-gradient(ellipse at 75% 65%, rgba(122, 154, 148, 0.1), transparent 50%),
        linear-gradient(160deg, #F0EBE1 0%, #E8E2D6 35%, #F0EBE1 70%, #E5DFD3 100%)
      `,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px",
      fontFamily: fonts.ui,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{
        width: "320px", height: "640px", borderRadius: "44px",
        background: "rgba(240, 235, 225, 0.3)",
        backdropFilter: "blur(40px) saturate(200%)",
        WebkitBackdropFilter: "blur(40px) saturate(200%)",
        border: "1px solid rgba(240, 235, 225, 0.6)",
        position: "relative", overflow: "hidden",
        boxShadow: `
          0 40px 100px rgba(44, 44, 42, 0.1),
          0 10px 40px rgba(44, 44, 42, 0.06),
          inset 0 2px 0 rgba(255, 255, 255, 0.4),
          inset 0 -1px 0 rgba(240, 235, 225, 0.3)
        `,
      }}>
        <div style={{
          position: "absolute", top: "8px", left: "50%", transform: "translateX(-50%)",
          width: "100px", height: "28px", background: colors.charcoal,
          borderRadius: "20px", zIndex: 10, boxShadow: "0 2px 8px rgba(44,44,42,0.15)",
        }} />
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{
            padding: "48px 20px 20px", flex: 1, boxSizing: "border-box",
            display: "flex", flexDirection: "column", overflowY: "auto",
            paddingBottom: hideNav ? "20px" : "8px",
          }}>
            <Routes>
              <Route path="/" element={<Home />} />

              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />

              <Route path="/give" element={<Categories />} />
              <Route path="/give/:category" element={<Countries />} />
              <Route path="/give/:category/:countryCode" element={<GiftList />} />
              <Route path="/gift/:itemId" element={<GiftDetail />} />

              <Route path="/checkout/success" element={
                <RequireAuth><CheckoutSuccess /></RequireAuth>
              } />
              <Route path="/orders" element={
                <RequireAuth requireVerified={false}><Orders /></RequireAuth>
              } />
              <Route path="/orders/:orderId" element={
                <RequireAuth requireVerified={false}><Tracking /></RequireAuth>
              } />
              <Route path="/profile" element={
                <RequireAuth requireVerified={false}><Profile /></RequireAuth>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          {!hideNav && <BottomNav />}
        </div>
      </div>

      <div style={{ marginTop: "24px", textAlign: "center" }}>
        <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.body, letterSpacing: "0.02em" }}>
          Amelior8
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
