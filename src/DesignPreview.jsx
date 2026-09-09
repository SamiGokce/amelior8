/**
 * Dev-only design preview.
 *
 * Renders the real components with sample props so the layout can be checked
 * without a populated Firestore. It is registered ONLY when import.meta.env.DEV
 * is true, so Vite strips it from production builds entirely — this data can
 * never reach a donor.
 *
 * Run: npm run dev, then open /preview
 */

import { useState } from "react";
import { colors, fonts, radius, surfaces } from "./theme";
import { Icon, renderIcon } from "./icons";
import { Wordmark } from "./components/Brand";
import { Btn, Chip, IconButton } from "./components/Btn";
import { SearchField } from "./components/SearchField";
import { CategoryTile, ListRow, SectionHeader, Thumb } from "./components/Catalog";
import { CATEGORY_META } from "./hooks/useCatalog";

const SAMPLE_DONATIONS = [
  { id: "1", name: "One month of food staples", country: "Kenya", date: "May 12, 2026", category: "food" },
  { id: "2", name: "School supply kit", country: "Uganda", date: "Apr 28, 2026", category: "education" },
  { id: "3", name: "Family water filter", country: "Tanzania", date: "Apr 10, 2026", category: "water" },
];

function Screen({ children }) {
  return (
    <div style={{
      width: "390px", height: "780px", borderRadius: "42px",
      background: colors.page, overflow: "hidden",
      boxShadow: "0 30px 80px rgba(28,28,26,0.13), 0 6px 20px rgba(28,28,26,0.06)",
      border: "1px solid rgba(28,28,26,0.06)",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{
        flex: 1, overflowY: "auto", padding: "26px 20px 12px",
        display: "flex", flexDirection: "column",
      }}>{children}</div>
      <div style={{ padding: "0 14px 16px" }}>
        <div style={{
          display: "flex", justifyContent: "space-around", alignItems: "center",
          padding: "10px 6px", background: colors.surface, borderRadius: "26px",
          boxShadow: "0 2px 6px rgba(28,28,26,0.06), 0 10px 30px rgba(28,28,26,0.07)",
        }}>
          {[
            { i: "homeFilled", l: "Home", on: true },
            { i: "list", l: "Activity" },
            { i: "heart", l: "Impact" },
            { i: "user", l: "Account" },
          ].map((t) => (
            <div key={t.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1 }}>
              {renderIcon(t.i, 21, t.on ? colors.text : colors.textTertiary)}
              <span style={{ fontSize: "10px", fontFamily: fonts.ui, color: t.on ? colors.text : colors.textTertiary, fontWeight: t.on ? 700 : 500 }}>{t.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HomePreview() {
  const [q, setQ] = useState("");
  return (
    <Screen>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
        <Wordmark />
        <IconButton icon="bell" size={38} badge />
      </div>
      <h1 style={{
        fontFamily: fonts.display, fontSize: "31px", fontWeight: 700, color: colors.text,
        margin: "0 0 18px", letterSpacing: "-0.05em", lineHeight: 1.1,
      }}>Search to<br />Ameliorate</h1>
      <SearchField value={q} onChange={setQ} />
      <div style={{ display: "flex", gap: "7px", marginTop: "18px", overflowX: "auto", minWidth: 0 }}>
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <CategoryTile key={key} icon={meta.icon} label={meta.label} color={meta.color} />
        ))}
      </div>
      <SectionHeader title="Past Donations" actionLabel="See all" />
      <div style={{ ...surfaces.card, padding: "4px 14px" }}>
        {SAMPLE_DONATIONS.map((d, i) => (
          <div key={d.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${colors.divider}` }}>
            <ListRow
              icon={CATEGORY_META[d.category].icon}
              tint={CATEGORY_META[d.category].color}
              title={d.name}
              lines={[d.country, d.date]}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto", paddingTop: "18px" }}>
        <Btn>Make a donation</Btn>
      </div>
    </Screen>
  );
}

function DetailPreview() {
  const [qty, setQty] = useState(1);
  const unit = 5500;
  return (
    <Screen>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <IconButton icon="arrowLeft" />
        <div style={{ display: "flex", gap: "8px" }}>
          <IconButton icon="heart" /><IconButton icon="share" />
        </div>
      </div>
      <div style={{
        width: "100%", aspectRatio: "4/3", borderRadius: radius.xl,
        background: `${colors.categoryFood}12`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{renderIcon("wheat", 52, colors.categoryFood)}</div>

      <h1 style={{
        fontFamily: fonts.display, fontSize: "23px", fontWeight: 700, color: colors.text,
        margin: "18px 0 5px", letterSpacing: "-0.04em",
      }}>One month of food staples</h1>
      <p style={{ fontSize: "13.5px", color: colors.textSecondary, margin: "0 0 16px", lineHeight: 1.5, fontFamily: fonts.body }}>
        Maize flour, beans, rice, cooking oil and salt for a family of four.
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {[
          { icon: "heart", c: colors.accent, bg: colors.accentLight, v: "$55", l: "Donation" },
          { icon: "user", c: colors.textSecondary, bg: "rgba(107,107,82,0.12)", v: "Local", l: "Relay" },
          { icon: "video", c: colors.categoryWater, bg: "rgba(59,147,224,0.12)", v: "Photo", l: "You receive" },
        ].map((t) => (
          <div key={t.l} style={{ flex: 1, ...surfaces.tile, padding: "12px 10px", minWidth: 0 }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "9px", background: t.bg,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "9px",
            }}>{renderIcon(t.icon, 15, t.c)}</div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: colors.text, margin: "0 0 2px", fontFamily: fonts.ui }}>{t.v}</p>
            <p style={{ fontSize: "10.5px", color: colors.textTertiary, margin: 0, fontFamily: fonts.ui }}>{t.l}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 11px", fontFamily: fonts.ui }}>Choose amount</p>
      <div style={{ display: "flex", gap: "7px", marginBottom: "12px" }}>
        {[1, 2, 3, 5].map((n) => (
          <Chip key={n} selected={qty === n} onClick={() => setQty(n)} style={{ flex: 1, padding: "11px 6px" }}>
            ${((unit * n) / 100).toFixed(0)}
          </Chip>
        ))}
        <Chip style={{ flex: 1, padding: "11px 6px" }}>Other</Chip>
      </div>

      <div style={{ marginTop: "auto", paddingTop: "12px" }}>
        <Btn>Continue — ${((unit * qty) / 100).toFixed(0)}</Btn>
      </div>
    </Screen>
  );
}

function ImpactPreview() {
  return (
    <Screen>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <IconButton icon="arrowLeft" />
        <IconButton icon="share" />
      </div>
      <h1 style={{
        fontFamily: fonts.display, fontSize: "26px", fontWeight: 700, color: colors.text,
        margin: "0 0 6px", letterSpacing: "-0.045em", lineHeight: 1.15,
      }}>Your donation<br />made an impact.</h1>
      <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 16px", fontFamily: fonts.ui }}>
        Here's what you helped make possible.
      </p>

      <div style={{
        width: "100%", aspectRatio: "4/3", borderRadius: radius.xl,
        background: colors.surfaceSunken,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <p style={{ fontSize: "12px", color: colors.textTertiary, fontFamily: fonts.ui }}>Delivery photo</p>
      </div>

      <div style={{ marginTop: "10px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          background: "rgba(90,138,100,0.14)", borderRadius: radius.pill, padding: "5px 10px",
        }}>
          {Icon.check(12, colors.successText)}
          <span style={{ fontSize: "10px", fontWeight: 700, color: colors.successText, fontFamily: fonts.caption }}>AI Verified</span>
        </div>
      </div>

      <div style={{ ...surfaces.card, padding: "13px 14px", marginTop: "12px", display: "flex", alignItems: "center", gap: "11px" }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "50%", background: colors.accentLight,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{Icon.user(19, colors.accent)}</div>
        <div>
          <p style={{ fontSize: "13.5px", fontWeight: 700, color: colors.text, margin: "0 0 2px", fontFamily: fonts.ui }}>Delivered by James M.</p>
          <p style={{ fontSize: "11.5px", color: colors.textTertiary, margin: 0, fontFamily: fonts.ui }}>Nairobi, Kenya</p>
        </div>
      </div>

      <div style={{ ...surfaces.tile, padding: "15px", marginTop: "10px", display: "flex", gap: "10px" }}>
        <div style={{ flexShrink: 0, paddingTop: "2px" }}>{Icon.quote(17, colors.textTertiary)}</div>
        <p style={{ fontSize: "13.5px", color: colors.text, margin: 0, lineHeight: 1.55, fontFamily: fonts.body }}>
          Thank you so much. This meal means a lot to my family.
        </p>
      </div>

      <div style={{ marginTop: "auto", paddingTop: "18px" }}>
        <Btn>View all impact</Btn>
      </div>
    </Screen>
  );
}

export default function DesignPreview() {
  return (
    <div style={{
      minHeight: "100vh", background: colors.page, padding: "40px 30px",
      display: "flex", gap: "26px", justifyContent: "flex-start", alignItems: "flex-start",
      fontFamily: fonts.ui, overflowX: "auto",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <HomePreview />
      <DetailPreview />
      <ImpactPreview />
    </div>
  );
}
