import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useMyOrders } from "../hooks/useOrder";
import { useCategories, useCountries, useGiftItems, searchItems, CATEGORY_META } from "../hooks/useCatalog";
import { stageStates, statusExplanation } from "../../shared/orderStatus";
import { formatDate, formatUsd } from "../lib/format";
import { colors, fonts, radius, surfaces } from "../theme";
import { Icon } from "../icons";
import { Wordmark } from "../components/Brand";
import { Btn, IconButton } from "../components/Btn";
import { SearchField } from "../components/SearchField";
import { CategoryTile, ListRow, SectionHeader } from "../components/Catalog";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders } = useMyOrders();
  const { categories } = useCategories();
  const { data: items } = useGiftItems();
  const { data: countries } = useCountries();
  const [query, setQuery] = useState("");

  const results = query.trim() ? searchItems(items, query, countries) : [];
  const countryName = (code) => countries.find((c) => c.code === code)?.name || code;

  const past = orders.filter((o) => o.paymentStatus === "succeeded");
  const active = orders.find((o) => !["VERIFIED", "REFUNDED", "PAYMENT_FAILED"].includes(o.status));
  const hasUnread = orders.some((o) => o.status === "VERIFIED" && !o.donorSeenAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
        <Wordmark />
        <IconButton
          icon="bell"
          size={38}
          badge={hasUnread}
          onClick={() => navigate("/activity")}
        />
      </div>

      <h1 style={{
        fontFamily: fonts.display, fontSize: "31px", fontWeight: 700,
        color: colors.text, margin: "0 0 18px", letterSpacing: "-0.05em", lineHeight: 1.1,
      }}>
        Search to<br />Ameliorate
      </h1>

      <SearchField value={query} onChange={setQuery} />

      {/* Search results replace the browse view while a query is active. */}
      {query.trim() ? (
        <div style={{ marginTop: "16px" }}>
          {results.length === 0 ? (
            <p style={{ fontSize: "13px", color: colors.textSecondary, fontFamily: fonts.body, margin: "10px 0" }}>
              Nothing matches "{query}".
            </p>
          ) : (
            <div style={{ ...surfaces.card, padding: "4px 14px" }}>
              {results.slice(0, 8).map((item, i) => (
                <div key={item.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${colors.divider}` }}>
                  <ListRow
                    icon={CATEGORY_META[item.category]?.icon}
                    tint={CATEGORY_META[item.category]?.color}
                    image={item.imageUrl}
                    title={item.name}
                    lines={[countryName(item.countryCode)]}
                    right={
                      <span style={{ fontSize: "13px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>
                        {formatUsd(item.priceUsdCents + item.facilitatorFeeUsdCents + item.platformFeeUsdCents)}
                      </span>
                    }
                    onClick={() => navigate(`/gift/${item.id}`)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{
            display: "flex", gap: "7px", marginTop: "18px",
            overflowX: "auto", paddingBottom: "4px", minWidth: 0,
          }}>
            {categories.map((cat) => (
              <CategoryTile
                key={cat.key}
                icon={cat.icon}
                label={cat.label}
                color={cat.color}
                onClick={() => navigate(`/give/${cat.key}`)}
              />
            ))}
          </div>

          {active && (
            <>
              <SectionHeader title="In progress" />
              <div
                onClick={() => navigate(`/orders/${active.id}`)}
                style={{ ...surfaces.card, padding: "14px", cursor: "pointer" }}
              >
                <p style={{ fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 4px", fontFamily: fonts.ui }}>
                  {active.itemSnapshot?.name || "Your gift"}
                </p>
                <p style={{ fontSize: "11.5px", color: colors.textTertiary, margin: "0 0 11px", lineHeight: 1.45, fontFamily: fonts.ui }}>
                  {statusExplanation(active)}
                </p>
                <div style={{ display: "flex", gap: "4px" }}>
                  {stageStates(active).map((stage) => (
                    <div key={stage.key} style={{
                      flex: 1, height: "3px", borderRadius: "2px",
                      background: stage.state === "complete"
                        ? colors.charcoal
                        : stage.state === "current"
                          ? colors.accent
                          : colors.surfaceSunken,
                    }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {past.length > 0 && (
            <>
              <SectionHeader
                title="Past Donations"
                actionLabel="See all"
                onAction={() => navigate("/activity")}
              />
              <div style={{ ...surfaces.card, padding: "4px 14px" }}>
                {past.slice(0, 3).map((order, i) => (
                  <div key={order.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${colors.divider}` }}>
                    <ListRow
                      image={order.proofThumbUrl || order.itemSnapshot?.imageUrl}
                      icon={CATEGORY_META[order.itemSnapshot?.category]?.icon}
                      tint={CATEGORY_META[order.itemSnapshot?.category]?.color}
                      title={order.itemSnapshot?.name || "Gift"}
                      lines={[
                        order.countrySnapshot?.name || order.countryCode,
                        formatDate(order.createdAt),
                      ]}
                      onClick={() => navigate(`/orders/${order.id}`)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {!user && (
            <div style={{ ...surfaces.accent, padding: "16px", marginTop: "18px" }}>
              <h2 style={{
                fontFamily: fonts.display, fontSize: "16px", fontWeight: 700,
                color: colors.text, margin: "0 0 6px", letterSpacing: "-0.03em",
              }}>Give something real</h2>
              <p style={{ fontSize: "12.5px", color: colors.textSecondary, margin: 0, lineHeight: 1.5, fontFamily: fonts.body }}>
                Pick a specific gift. A vetted local facilitator buys it, delivers it
                in person, and sends you a photo of the handover.
              </p>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: "auto", paddingTop: "22px" }}>
        <Btn onClick={() => navigate("/give")}>
          {past.length > 0 ? "Make a donation" : "Make a donation"}
        </Btn>
        {!user && (
          <p
            onClick={() => navigate("/signin")}
            style={{
              fontSize: "12px", color: colors.textTertiary, margin: "12px 0 0",
              textAlign: "center", fontFamily: fonts.ui, cursor: "pointer",
            }}
          >
            Already given? <span style={{ color: colors.accent, fontWeight: 700 }}>Sign in</span>
          </p>
        )}
      </div>
    </div>
  );
}
