import { useCallback, useEffect, useState } from "react";
import { orgApi } from "../api";
import { useOrgAuth } from "../useOrgAuth";
import { colors, fonts, radius } from "../../theme";
import { Icon } from "../../icons";
import {
  Banner, Button, Card, Empty, Field, H1, Label, Muted, Spinner, StatusPill,
} from "../components";

function randomPin() {
  // Avoids the shapes validatePin() rejects, so a suggested PIN always works.
  let pin = "";
  for (let i = 0; i < 6; i++) pin += Math.floor(Math.random() * 10);
  return /^(\d)\1+$/.test(pin) ? randomPin() : pin;
}

function AddRelay({ onDone, onCancel }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState(randomPin());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await orgApi.createRelay({ name, username, pin, phone: phone || null });
      // Shown once. The PIN is the Firebase credential and is never stored or
      // returned again — if it is lost, an admin sets a new one.
      setCreated({ ...res.relay, pin });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Card style={{ marginBottom: "12px", background: "rgba(90, 138, 100, 0.08)" }}>
        <Label>Relay added</Label>
        <div style={{ height: "10px" }} />
        <Muted style={{ marginBottom: "12px" }}>
          Give <strong>{created.name}</strong> these details. The PIN is shown once and
          cannot be looked up later — if it is lost you can set a new one.
        </Muted>
        <div style={{
          background: colors.surface, borderRadius: radius.md, padding: "14px",
          fontFamily: fonts.mono, fontSize: "14px", marginBottom: "14px",
        }}>
          <div>Username: <strong>{created.username}</strong></div>
          <div>PIN: <strong>{created.pin}</strong></div>
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "8px", fontFamily: fonts.ui }}>
            They sign in at {window.location.origin}/relay
          </div>
        </div>
        <Button onClick={onDone}>Done</Button>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: "12px" }}>
      <Label>Add a relay</Label>
      <div style={{ height: "12px" }} />
      {error && <Banner tone="error">{error}</Banner>}

      <Field label="Name" value={name} onChange={setName} placeholder="James Mwangi" />
      <Field
        label="Username"
        value={username}
        onChange={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        placeholder="james-m"
        hint="Lowercase letters, numbers and hyphens. Unique across Amelior8."
      />
      <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+254..." />
      <Field
        label="PIN"
        value={pin}
        onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 12))}
        placeholder="6 digits"
        hint="6 to 12 digits, not all the same and not a run. Hand it over in person."
        inputMode="numeric"
      />

      <div style={{ display: "flex", gap: "8px" }}>
        <Button onClick={submit} disabled={busy || !name.trim() || username.length < 3 || pin.length < 6}>
          {busy ? "Adding..." : "Add relay"}
        </Button>
        <Button variant="quiet" onClick={onCancel}>Cancel</Button>
        <Button variant="quiet" onClick={() => setPin(randomPin())}>Suggest a PIN</Button>
      </div>
    </Card>
  );
}

function RelayCard({ relay, isAdmin, onChanged }) {
  const [error, setError] = useState(null);
  const [newPin, setNewPin] = useState("");
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(null);

  async function update(payload, afterMessage) {
    setBusy(true);
    setError(null);
    try {
      await orgApi.updateRelay(relay.id, payload);
      if (afterMessage) setShown(afterMessage);
      onChanged();
      setResetting(false);
      setNewPin("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ marginBottom: "10px", opacity: relay.active ? 1 : 0.6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "4px" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>
              {relay.name}
            </span>
            {!relay.active && (
              <span style={{
                fontSize: "10.5px", fontWeight: 700, color: colors.textSecondary,
                background: colors.surfaceMuted, padding: "4px 9px", borderRadius: radius.pill,
                fontFamily: fonts.caption,
              }}>Deactivated</span>
            )}
          </div>
          <Muted style={{ fontSize: "12.5px" }}>
            {relay.username}
            {relay.phone ? ` · ${relay.phone}` : ""}
            {` · ${relay.completedDeliveries} delivered`}
          </Muted>

          {relay.assigned.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <Label>Currently holding</Label>
              <div style={{ marginTop: "6px" }}>
                {relay.assigned.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0" }}>
                    <StatusPill status={a.status} />
                    <span style={{ fontSize: "12.5px", color: colors.text, fontFamily: fonts.ui }}>
                      {a.item}{a.recipient ? ` — for ${a.recipient}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {isAdmin && (
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "flex-start" }}>
            <Button variant="secondary" onClick={() => setResetting((v) => !v)}>New PIN</Button>
            <Button
              variant={relay.active ? "quiet" : "secondary"}
              onClick={() => update({ active: !relay.active })}
              disabled={busy}
            >{relay.active ? "Deactivate" : "Reactivate"}</Button>
          </div>
        )}
      </div>

      {error && <div style={{ marginTop: "12px" }}><Banner tone="error">{error}</Banner></div>}
      {shown && <div style={{ marginTop: "12px" }}><Banner tone="success">{shown}</Banner></div>}

      {resetting && (
        <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${colors.divider}` }}>
          <Field
            label="New PIN"
            value={newPin}
            onChange={(v) => setNewPin(v.replace(/\D/g, "").slice(0, 12))}
            placeholder="6 digits"
            hint="Setting a new PIN signs them out of every device."
            inputMode="numeric"
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              onClick={() => update({ pin: newPin }, `New PIN set. Give ${relay.name} the code ${newPin}.`)}
              disabled={busy || newPin.length < 6}
            >Set PIN</Button>
            <Button variant="quiet" onClick={() => { setResetting(false); setNewPin(""); }}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Relays() {
  const { isAdmin } = useOrgAuth();
  const [relays, setRelays] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setRelays((await orgApi.relays()).relays);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <H1>Relays</H1>
          <Muted style={{ marginBottom: "18px" }}>
            The people who buy and deliver gifts for your organisation.
          </Muted>
        </div>
        {isAdmin && !adding && <Button onClick={() => setAdding(true)}>Add a relay</Button>}
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {!isAdmin && <Banner>Only an organisation admin can add or edit relays.</Banner>}

      {adding && <AddRelay onDone={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}

      {relays === null ? <Spinner label="Loading relays" /> : relays.length === 0 && !adding ? (
        <Empty
          title="No relays yet"
          message="Add the people who will collect and deliver gifts. Each one gets a username and a PIN to sign in on their phone."
          action={isAdmin ? "Add your first relay" : undefined}
          onAction={isAdmin ? () => setAdding(true) : undefined}
        />
      ) : (
        relays.map((r) => <RelayCard key={r.id} relay={r} isAdmin={isAdmin} onChanged={load} />)
      )}
    </div>
  );
}
