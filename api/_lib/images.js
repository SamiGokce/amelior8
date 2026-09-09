import sharp from "sharp";

/**
 * Image safeguarding for delivery photos.
 *
 * Two separate obligations, both default-closed:
 *
 *  1. A recipient's location must never be recoverable from a file we store.
 *     Every uploaded image is re-encoded with all metadata dropped, so GPS,
 *     device and timestamp EXIF never reach Storage.
 *
 *  2. A donor sees a blurred face by default. The original is kept for the
 *     org's review and the audit trail; the donor is served a derivative.
 *     If we cannot produce that derivative for any reason, the donor is shown
 *     nothing — never the unblurred original.
 */

const MAX_EDGE = 1600;

/**
 * Re-encodes an image, dropping every metadata block including GPS.
 *
 * sharp discards metadata unless `withMetadata()` is called, so this is a
 * re-encode rather than a targeted strip — which also removes anything we did
 * not think to look for.
 */
export async function stripMetadata(buffer) {
  const image = sharp(buffer, { failOn: "none" }).rotate(); // apply EXIF orientation, then lose it
  const meta = await image.metadata();

  const resized = Math.max(meta.width || 0, meta.height || 0) > MAX_EDGE
    ? image.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    : image;

  return {
    buffer: await resized.jpeg({ quality: 85 }).toBuffer(),
    contentType: "image/jpeg",
    hadLocation: !!(meta.exif && await hasGps(buffer)),
  };
}

/** Only used to record that location data was present and removed. */
async function hasGps(buffer) {
  try {
    const { exif } = await sharp(buffer, { failOn: "none" }).metadata();
    // The GPS IFD marker. Crude, but we only need a boolean for the audit log.
    return !!exif && exif.includes(Buffer.from("GPS"));
  } catch {
    return false;
  }
}

/**
 * Blurs the given regions of an image.
 *
 * Boxes are normalized 0-1 relative to width and height. Each is padded
 * outward, because a box that clips the edge of a face leaves an ear and a
 * jawline identifiable.
 *
 * Blur is applied by compositing pre-blurred crops over the original, so the
 * rest of the photo stays sharp enough to serve as proof.
 */
export async function blurRegions(buffer, boxes, { padding = 0.18 } = {}) {
  const image = sharp(buffer, { failOn: "none" });
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error("Could not read image dimensions");

  const composites = [];

  for (const box of boxes) {
    const padW = box.width * padding;
    const padH = box.height * padding;

    const left = Math.max(0, Math.round((box.x - padW) * width));
    const top = Math.max(0, Math.round((box.y - padH) * height));
    const w = Math.min(width - left, Math.round((box.width + padW * 2) * width));
    const h = Math.min(height - top, Math.round((box.height + padH * 2) * height));
    if (w < 4 || h < 4) continue;

    // Sigma scaled to the region, so a small face is blurred as thoroughly as
    // a large one rather than staying legible.
    const sigma = Math.max(8, Math.round(Math.max(w, h) / 6));
    const patch = await sharp(buffer, { failOn: "none" })
      .extract({ left, top, width: w, height: h })
      .blur(sigma)
      .toBuffer();

    composites.push({ input: patch, left, top });
  }

  if (composites.length === 0) return null;

  return sharp(buffer, { failOn: "none" })
    .composite(composites)
    .jpeg({ quality: 82 })
    .toBuffer();
}

/**
 * The fallback when face positions are unknown: blur everything.
 *
 * Deliberately unhelpful to look at. It is what a donor gets when we cannot
 * be confident about who is in the photo — the safe failure, not the
 * convenient one.
 */
export async function blurEntire(buffer) {
  const image = sharp(buffer, { failOn: "none" });
  const { width, height } = await image.metadata();
  const sigma = Math.max(20, Math.round(Math.max(width || 800, height || 600) / 25));
  return image.blur(sigma).jpeg({ quality: 80 }).toBuffer();
}
