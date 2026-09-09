import { useRef, useState } from "react";
import { colors, fonts, radius } from "../theme";
import { Icon } from "../icons";

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Shrinks a phone photo before it goes anywhere.
 *
 * A modern camera produces 4-8MB per shot. On the connections relays actually
 * work on, uploading that is the difference between a job finishing and a job
 * failing — and it is the relay's own data being spent. 1600px is plenty for
 * verification, by eye or by model.
 *
 * If anything about the resize fails, the original is used rather than losing
 * the photo.
 */
export async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_200_000) {
      return { blob: file, contentType: file.type || "image/jpeg" };
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) return { blob: file, contentType: file.type || "image/jpeg" };
    return { blob, contentType: "image/jpeg" };
  } catch {
    return { blob: file, contentType: file.type || "image/jpeg" };
  }
}

/** Big tap target that opens the camera, then previews what was taken. */
export function PhotoInput({ label, hint, value, onChange }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorking(true);
    const compressed = await compressImage(file);
    setPreview(URL.createObjectURL(compressed.blob));
    onChange(compressed);
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

      {hint && (
        <p style={{
          fontSize: "12px", color: colors.textTertiary, margin: "8px 0 0",
          lineHeight: 1.5, fontFamily: fonts.ui,
        }}>{hint}</p>
      )}
    </div>
  );
}
