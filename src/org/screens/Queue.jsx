import { useCallback, useEffect, useState } from "react";
import { orgApi } from "../api";
import { colors, fonts, radius, surfaces } from "../../theme";
import { Icon } from "../../icons";
import {
  Banner, Button, Card, Empty, Field, H1, Label, Muted, Select,
  Spinner, StatusPill, money, when,
} from "../components";

const TABS = [
  { key: "unassigned", label: "Needs a relay" },
  { key: "review", label: "Needs review" },
  { key: "open", label: "In progress" },
  { key: "all", label: "All" },
];

/** Assigning is also where the recipient gets recorded — they go together. */
function AssignPanel({ order, relays, onDone, onCancel }) {
  const [relayId, setRelayId] = useState("");
  const [firstName, setFirstName] = useState(order.recipient?.firstName || "");
  const [area, setArea] = useState(order.recipient?.area || "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const active = relays.filter((r) => r.active);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await orgApi.assign(order.id, { relayId, recipient: { firstName, area } });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Card style={{ marginTop: "10px", background: colors.surfaceMuted }}>
      <Label>Assign this gift</Label>
      <div style={{ height: "12px" }} />

      {error && <Banner tone="error">{error}</Banner>}

      {active.length === 0 ? (
        <Muted>You have no active relays yet. Add one under Relays first.</Muted>
      ) : (
        <>
          <Select
            label="Relay"
            value={relayId}
            onChange={setRelayId}
            placeholder="Choose a relay"
            options={active.map((r) => ({
              value: r.id,
              label: `${r.name}${r.assigned.length ? ` — ${r.assigned.length} in progress` : " — free"}`,
            }))}
          />
          <Field
            label="Recipient first name"
            value={firstName}
            onChange={setFirstName}
            placeholder="Joseph"
            hint="First name only. Do not record surnames or ID numbers."
          />
          <Field
            label="Area"
            value={area}
            onChange={setArea}
            placeholder="Kisumu"
            hint="A general area, not a street address."
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <Button onClick={submit} disabled={busy || !relayId || !firstName.trim()}>
              {busy ? "Assigning..." : "Assign"}
            </Button>
            <Button variant="quiet" onClick={onCancel}>Cancel</Button>
          </div>
        </>
      )}
    </Card>
  );
}

function OrderRow({ order, relays, onChanged, onReview }) {
  const [assigning, setAssigning] = useState(false);

  return (
    <Card style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "5px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>
              {order.item || "Gift"}
            </span>
            <StatusPill status={order.status} />
            {order.purchase?.overBudget && (
              <span style={{
                fontSize: "10.5px", fontWeight: 700, color: "#B03028", fontFamily: fonts.caption,
                background: "rgba(224,67,59,0.10)", padding: "4px 9px", borderRadius: radius.pill,
              }}>Over budget</span>
            )}
          </div>
          <Muted style={{ fontSize: "12.5px" }}>
            {order.quantity > 1 ? `${order.quantity} x · ` : ""}
            Budget {money(order.giftAmount)} · {order.country}
            {order.recipient?.firstName ? ` · for ${order.recipient.firstName}` : ""}
            {order.relay ? ` · ${order.relay}` : ""}
          </Muted>
          <p style={{ fontSize: "11px", color: colors.textTertiary, margin: "5px 0 0", fontFamily: fonts.mono }}>
            {order.id} · {when(order.createdAt)}
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          {order.status === "FUNDED" && (
            <Button onClick={() => setAssigning((v) => !v)}>
              {assigning ? "Close" : "Assign a relay"}
            </Button>
          )}
          {["ASSIGNED", "PURCHASED"].includes(order.status) && (
            <Button variant="secondary" onClick={() => setAssigning((v) => !v)}>Reassign</Button>
          )}
          {order.status === "DELIVERED" && (
            <Button onClick={() => onReview(order.id)}>Review delivery</Button>
          )}
        </div>
      </div>

      {assigning && (
        <AssignPanel
          order={order}
          relays={relays}
          onDone={() => { setAssigning(false); onChanged(); }}
          onCancel={() => setAssigning(false)}
        />
      )}
    </Card>
  );
}

export default function Queue({ onReview }) {
  const [tab, setTab] = useState("unassigned");
  const [data, setData] = useState(null);
  const [relays, setRelays] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orders, roster] = await Promise.all([orgApi.orders({ view: tab }), orgApi.relays()]);
      setData(orders);
      setRelays(roster.relays);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <H1>Gifts</H1>
      <Muted style={{ marginBottom: "18px" }}>
        Everything donors have funded for your organisation.
      </Muted>

      <div style={{ display: "flex", gap: "7px", marginBottom: "16px", flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const count = t.key === "unassigned"
            ? data?.counts?.unassigned
            : t.key === "review" ? data?.counts?.awaitingReview : null;
          const on = tab === t.key;
          return (
            <div
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "9px 15px", borderRadius: radius.pill, cursor: "pointer",
                background: on ? colors.charcoal : colors.surface,
                color: on ? "#FFF" : colors.textSecondary,
                border: on ? "none" : `1px solid ${colors.border}`,
                fontSize: "12.5px", fontWeight: 700, fontFamily: fonts.ui,
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              {t.label}
              {count > 0 && (
                <span style={{
                  background: on ? "rgba(255,255,255,0.22)" : colors.accentLight,
                  color: on ? "#FFF" : colors.accent,
                  borderRadius: radius.pill, padding: "1px 7px", fontSize: "11px",
                }}>{count}</span>
              )}
            </div>
          );
        })}
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      {loading ? <Spinner label="Loading gifts" /> : !data?.orders.length ? (
        <Empty
          title={tab === "unassigned" ? "Nothing waiting for a relay" : tab === "review" ? "Nothing to review" : "No gifts yet"}
          message={
            tab === "unassigned" ? "When a donor funds a gift for your organisation, it appears here."
            : tab === "review" ? "Deliveries your relays submit will arrive here for your decision."
            : "Funded gifts for your organisation will show up here."
          }
        />
      ) : (
        data.orders.map((o) => (
          <OrderRow key={o.id} order={o} relays={relays} onChanged={load} onReview={onReview} />
        ))
      )}
    </div>
  );
}
