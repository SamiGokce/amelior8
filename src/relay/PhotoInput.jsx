import { useRef, useState } from "react";
import { colors, fonts, radius } from "../theme";
import { Icon } from "../icons";

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Shrinks a phone photo and strips its metadata before it goes anywhere.
 *
 * Two jobs in one pass:
 *
 *  - Size. A modern camera produces 4-8MB per shot. On the connections relays
 *    actually work on, uploading that is the difference between a job
 *    finishing and one failing, on the relay's own data. 1600px is plenty for
 *    verification, by eye or by model.
 *
 *  - Location. Drawing to a canvas and re-encoding discards every EXIF block,
 *    GPS included. This happens on every photo without exception — a small
 *    file is not a safe file, and the previous shortcut of passing small
 *    originals through kept their coordinates intact.
 *
 * The server strips metadata again on receipt. This is the first of the two.
 */
export async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    // A failed re-encode means metadata may survive, so refuse rather than
    // upload something we have not sanitised.
    if (!blob) throw new Error("Could not process the photo");
    return { blob, contentType: "image/jpeg", sanitised: true };
  } catch (err) {
    console.error("Photo processing failed:", err);
    return { error: "This photo could not be prepared. Try taking it again." };
  }
}

/** Big tap target that opens the camera, then previews what was taken. */
export function PhotoInput({ label, hint, value, onChange }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);

  const [failed, setFailed] = useState(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorking(true);
    setFailed(null);
    const result = await compressImage(file);
    if (result.error) {
      setFailed(result.error);
      onChange(null);
    } else {
      setPreview(URL.createObjectURL(result.blob));
      onChange(result);
    }
    setWorking(false);
  }

  return (
    <div style={{ marginBottom: "18px" }}>
      <p style={{
        fontSize: "11px", fontWeight: 700, color: colors.textTertiary,
        textTransform: "uppercase", letterSpacing: "0.08em",
        margin: "0 0 8px", fontFamily: fonts.caption,
      }}>{label}</p>

      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={pick}
        style={{ display: "none" }}
      />

      <div
        onClick={() => ref.current?.click()}
        style={{
          borderRadius: radius.lg, cursor: "pointer", overflow: "hidden",
          border: `1.5px dashed ${value ? "transparent" : colors.border}`,
          background: value ? "transparent" : colors.surface,
        }}
      >
        {preview ? (
          <img src={preview} alt="" style={{ width: "100%", display: "block", borderRadius: radius.lg }} />
        ) : (
          <div style={{
            padding: "34px 20px", display: "flex", flexDirection: "column",
            alignItems: "center", gap: "10px",
          }}>
            {Icon.camera(30, colors.textTertiary)}
            <span style={{ fontSize: "14.5px", fontWeight: 600, color: colors.text, fontFamily: fonts.ui }}>
              {working ? "Preparing..." : "Take a photo"}
            </span>
          </div>
        )}
      </div>

      {preview && (
        <p
          onClick={() => ref.current?.click()}
          style={{
            fontSize: "13px", color: colors.accent, fontWeight: 700,
            margin: "9px 0 0", fontFamily: fonts.ui, cursor: "pointer",
          }}
        >Take a different photo</p>
      )}

      {failed && (
        <p style={{
          fontSize: "12.5px", color: "#B03028", margin: "8px 0 0",
          lineHeight: 1.5, fontFamily: fonts.ui, fontWeight: 600,
        }}>{failed}</p>
      )}

      {hint && (
        <p style={{
          fontSize: "12px", color: colors.textTertiary, margin: "8px 0 0",
          lineHeight: 1.5, fontFamily: fonts.ui,
        }}>{hint}</p>
      )}
    </div>
  );
}
