import { colors, fonts, radius, surfaces } from "../../theme";
import { Icon } from "../../icons";

const money = (c) => (c === null || c === undefined ? "--" : `$${(c / 100).toFixed(2)}`);

const ACTION = {
  ASSIGNED: { label: "Buy it", tone: colors.accent },
  PURCHASED: { label: "Deliver it", tone: colors.accent },
  PROOF_REJECTED: { label: "New photo needed", tone: "#B03028" },
  DELIVERED: { label: "Being checked", tone: colors.textSecondary },
  VERIFIED: { label: "Done", tone: "#3D6B47" },
};

function JobCard({ job, queuedCount, onOpen }) {
  const action = ACTION[job.status];
  return (
    <div
      onClick={() => onOpen(job)}
      style={{ ...surfaces.card, padding: "16px", marginBottom: "10px", cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: "16px", fontWeight: 700, color: colors.text, margin: "0 0 4px",
            fontFamily: fonts.ui, lineHeight: 1.25,
          }}>{job.item}</p>
          <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0, fontFamily: fonts.ui }}>
            {job.recipient?.firstName ? `For ${job.recipient.firstName}` : "Recipient not set"}
            {job.recipient?.area ? `, ${job.recipient.area}` : ""}
          </p>
        </div>
        {Icon.chevronRight(19, colors.textTertiary)}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        marginTop: "13px", flexWrap: "wrap",
      }}>
        <span style={{
          fontSize: "12px", fontWeight: 700, color: action?.tone || colors.textSecondary,
          fontFamily: fonts.caption,
        }}>{action?.label || job.status}</span>
        <span style={{ fontSize: "12px", color: colors.textTertiary, fontFamily: fonts.ui }}>
          Budget {money(job.budgetUsdCents)} · you earn {money(job.earningUsdCents)}
        </span>
        {queuedCount > 0 && (
          <span style={{
            fontSize: "11px", fontWeight: 700, color: "#A34602", fontFamily: fonts.caption,
            background: "rgba(204,86,2,0.10)", padding: "3px 8px", borderRadius: radius.pill,
          }}>Waiting to send</span>
        )}
      </div>
    </div>
  );
}

export default function Jobs({ data, queueByOrder, onOpen }) {
  const { open = [], awaitingReview = [], done = [], summary } = data || {};

  return (
    <div style={{ padding: "6px 22px 40px", fontFamily: fonts.ui }}>
      {open.length === 0 && awaitingReview.length === 0 ? (
        <div style={{ ...surfaces.card, padding: "34px 22px", textAlign: "center", marginTop: "10px" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>
            Nothing to do right now
          </p>
          <p style={{ fontSize: "13.5px", color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
            When your organisation gives you a gift to deliver, it appears here.
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <>
              <p style={{
                fontSize: "11px", fontWeight: 700, color: colors.textTertiary,
                textTransform: "uppercase", letterSpacing: "0.08em",
                margin: "8px 0 10px", fontFamily: fonts.caption,
              }}>To do</p>
              {open.map((j) => (
                <JobCard key={j.id} job={j} queuedCount={queueByOrder[j.id]?.length || 0} onOpen={onOpen} />
              ))}
            </>
          )}

          {awaitingReview.length > 0 && (
            <>
              <p style={{
                fontSize: "11px", fontWeight: 700, color: colors.textTertiary,
                textTransform: "uppercase", letterSpacing: "0.08em",
                margin: "22px 0 10px", fontFamily: fonts.caption,
              }}>Sent, being checked</p>
              {awaitingReview.map((j) => (
                <JobCard key={j.id} job={j} queuedCount={0} onOpen={onOpen} />
              ))}
            </>
          )}
        </>
      )}

      {summary && (
        <div style={{ ...surfaces.tile, padding: "16px", marginTop: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "13.5px", color: colors.textSecondary }}>Deliveries completed</span>
            <span style={{ fontSize: "13.5px", fontWeight: 700, color: colors.text }}>{summary.completedCount}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13.5px", color: colors.textSecondary }}>Earned so far</span>
            <span style={{ fontSize: "13.5px", fontWeight: 700, color: colors.text }}>
              {money(summary.earnedUsdCents)}
            </span>
          </div>
          {/* No payout rail is wired yet. Saying so is better than implying money
              is on its way. */}
          <p style={{
            fontSize: "11.5px", color: colors.textTertiary, margin: "10px 0 0",
            lineHeight: 1.5, fontFamily: fonts.ui,
          }}>
            This is what you have earned. Payment is arranged by your organisation —
            it is not paid through this app yet.
          </p>
        </div>
      )}
    </div>
  );
}
