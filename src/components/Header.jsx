import { useNavigate } from "react-router-dom";
import { IconButton } from "./Btn";

/**
 * Floating circular controls over content — back on the left, actions on the
 * right. Replaces the old bordered title bar.
 */
export function Header({ onBack, actions = null, style: s = {} }) {
  const navigate = useNavigate();
  const back = onBack || (() => navigate(-1));

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: "16px", ...s,
    }}>
      <IconButton icon="arrowLeft" onClick={back} />
      {actions && <div style={{ display: "flex", gap: "8px" }}>{actions}</div>}
    </div>
  );
}
