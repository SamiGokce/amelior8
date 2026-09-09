import { useCallback, useEffect, useState } from "react";
import { orgApi } from "../api";
import { useOrgAuth } from "../useOrgAuth";
import { colors, fonts, radius } from "../../theme";
import {
  Banner, Button, Card, Field, H1, Label, Muted, Select, Spinner,
} from "../components";

export default function Team() {
  const { isAdmin, profile } = useOrgAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("org_staff");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await orgApi.team());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      const res = await orgApi.invite(email, role);
      setLink(res);
      setEmail("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <H1>Team</H1>
        <Muted style={{ marginBottom: "18px" }}>Who can use this portal for your organisation.</Muted>
        <Banner>Only an organisation admin can invite or manage colleagues.</Banner>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "620px" }}>
      <H1>Team</H1>
      <Muted style={{ marginBottom: "18px" }}>
        Who can use this portal for {profile?.org?.name || "your organisation"}.
      </Muted>

      {error && <Banner tone="error">{error}</Banner>}

      <Card style={{ marginBottom: "12px" }}>
        <Label>Invite a colleague</Label>
        <div style={{ height: "12px" }} />
        <Field label="Email" value={email} onChange={setEmail} placeholder="colleague@organisation.org" type="email" />
        <Select
          label="Role"
          value={role}
          onChange={setRole}
          placeholder="Choose a role"
          options={[
            { value: "org_staff", label: "Staff — assign relays and review deliveries" },
            { value: "org_admin", label: "Admin — everything, plus managing people" },
          ]}
        />
        <Button onClick={invite} disabled={busy || !email.trim()}>
          {busy ? "Creating invite..." : "Create invite link"}
        </Button>

        {link && (
          <div style={{ marginTop: "14px" }}>
            <Banner tone="success">
              Invite created for {link.email}. Send them this link — it works once and
              only for that address.
            </Banner>
            <div style={{
              background: colors.surfaceMuted, borderRadius: radius.md, padding: "12px",
              fontFamily: fonts.mono, fontSize: "11.5px", wordBreak: "break-all", color: colors.text,
            }}>{link.url}</div>
            <Button
              variant="secondary"
              style={{ marginTop: "10px" }}
              onClick={() => navigator.clipboard?.writeText(link.url)}
            >Copy link</Button>
          </div>
        )}
      </Card>

      {data === null ? <Spinner label="Loading team" /> : (
        <>
          <Card style={{ marginBottom: "12px" }}>
            <Label>Members</Label>
            <div style={{ height: "10px" }} />
            {data.members.length === 0 ? <Muted>Just you so far.</Muted> : data.members.map((m) => (
              <div key={m.uid} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderTop: `1px solid ${colors.divider}`,
              }}>
                <div>
                  <p style={{ fontSize: "13.5px", fontWeight: 600, color: colors.text, margin: 0, fontFamily: fonts.ui }}>
                    {m.name || m.email}
                  </p>
                  {m.name && <Muted style={{ fontSize: "12px" }}>{m.email}</Muted>}
                </div>
                <span style={{ fontSize: "11.5px", color: colors.textSecondary, fontFamily: fonts.ui, fontWeight: 600 }}>
                  {m.role === "org_admin" ? "Admin" : "Staff"}
                </span>
              </div>
            ))}
          </Card>

          {data.invites.length > 0 && (
            <Card>
              <Label>Pending invites</Label>
              <div style={{ height: "10px" }} />
              {data.invites.map((i) => (
                <div key={i.email} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderTop: `1px solid ${colors.divider}`,
                }}>
                  <span style={{ fontSize: "13px", color: colors.text, fontFamily: fonts.ui }}>{i.email}</span>
                  <Muted style={{ fontSize: "11.5px" }}>
                    {i.role === "org_admin" ? "Admin" : "Staff"} · expires {new Date(i.expiresAt).toLocaleDateString()}
                  </Muted>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
