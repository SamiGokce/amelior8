import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { colors, fonts, shadow } from "./theme";
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
import Impact from "./screens/Impact";
import Profile from "./screens/Profile";
import SignIn from "./screens/SignIn";
import SignUp from "./screens/SignUp";
import ForgotPassword from "./screens/ForgotPassword";
import VerifyEmail from "./screens/VerifyEmail";

// Dev-only design preview. import.meta.env.DEV is statically false in a
// production build, so Vite tree-shakes both the route and the module away.
const DesignPreview = import.meta.env.DEV
  ? (await import("./DesignPreview")).default
  : null;

const NAV_TABS = [
  { icon: "home", activeIcon: "homeFilled", label: "Home", path: "/" },
  { icon: "list", activeIcon: "list", label: "Activity", path: "/activity" },
  { icon: "heart", activeIcon: "heartFilled", label: "Impact", path: "/impact" },
  { icon: "user", activeIcon: "userFilled", label: "Account", path: "/profile" },
];

function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div style={{
      display: "flex", justifyContent: "space-around", alignItems: "center",
      padding: "10px 6px", background: colors.surface,
      borderRadius: "26px", boxShadow: shadow.raised, flexShrink: 0,
    }}>
      {NAV_TABS.map((tab) => {
        const isActive = tab.path === "/"
          ? pathname === "/"
          : pathname.startsWith(tab.path);
        const tint = isActive ? colors.text : colors.textTertiary;
        return (
          <div
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
              cursor: "pointer", padding: "3px 14px", flex: 1,
            }}
          >
            {renderIcon(isActive ? tab.activeIcon : tab.icon, 21, tint)}
            <span style={{
              fontSize: "10px", fontFamily: fonts.ui, color: tint,
              fontWeight: isActive ? 700 : 500,
            }}>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Signed in and email-verified, or you don't reach the giving flow. */
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
      minHeight: "100vh", background: colors.page,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", fontFamily: fonts.ui,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        * { -webkit-font-smoothing: antialiased; }
        input::placeholder { color: ${colors.textTertiary}; }
        /* Full-bleed on a real phone; framed device on larger screens. */
        .a8-frame {
          width: 100%; max-width: 420px; min-height: 100vh;
          background: ${colors.page};
          display: flex; flex-direction: column;
          position: relative; overflow: hidden;
        }
        @media (min-width: 640px) {
          .a8-frame {
            width: 390px; height: 780px; min-height: 0;
            border-radius: 42px;
            box-shadow: 0 30px 80px rgba(28,28,26,0.13), 0 6px 20px rgba(28,28,26,0.06);
            border: 1px solid rgba(28,28,26,0.06);
          }
        }
        .a8-scroll::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>

      <div className="a8-frame">
        <div
          className="a8-scroll"
          style={{
            flex: 1, overflowY: "auto", boxSizing: "border-box",
            padding: "26px 20px 12px",
            display: "flex", flexDirection: "column",
            scrollbarWidth: "none",
          }}
        >
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
            <Route path="/activity" element={
              <RequireAuth requireVerified={false}><Orders /></RequireAuth>
            } />
            <Route path="/impact" element={
              <RequireAuth requireVerified={false}><Impact /></RequireAuth>
            } />
            <Route path="/orders/:orderId" element={
              <RequireAuth requireVerified={false}><Tracking /></RequireAuth>
            } />
            <Route path="/profile" element={
              <RequireAuth requireVerified={false}><Profile /></RequireAuth>
            } />

            {/* /orders kept as an alias so older links still resolve. */}
            <Route path="/orders" element={<Navigate to="/activity" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {!hideNav && (
          <div style={{ padding: "0 14px 16px", flexShrink: 0 }}>
            <BottomNav />
          </div>
        )}
      </div>
    </div>
  );
}

function Root() {
  const { pathname } = useLocation();
  // The design preview renders its own phone frames, so it sits outside the
  // Shell rather than inside one.
  if (DesignPreview && pathname === "/preview") return <DesignPreview />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
