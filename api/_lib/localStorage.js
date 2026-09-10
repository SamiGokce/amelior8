// Local-disk stand-in for Firebase Storage. Active only when
// LOCAL_STORAGE_DIR is set — see scripts/dev-api.mjs. Never set on Vercel, so
// this has no effect in production; adminBucket() in admin.js is the only
// thing that reads LOCAL_STORAGE_DIR to decide whether to use this instead of
// real Storage.
import { promises as fs } from "node:fs";
import path from "node:path";

function root() {
  const dir = process.env.LOCAL_STORAGE_DIR;
  if (!dir) throw new Error("LOCAL_STORAGE_DIR is not set.");
  return dir;
}

const diskPath = (objectPath) => path.join(root(), objectPath);
const metaPath = (objectPath) => diskPath(objectPath) + ".meta.json";

function localFile(objectPath) {
  return {
    // Real Storage returns a signed URL string; the local server (see
    // scripts/dev-api.mjs) serves this same-origin path itself, GET to read
    // and PUT to write — proof.js only ever cares that it gets a URL back.
    async getSignedUrl() {
      return [`/api/__local-storage/${encodeURIComponent(objectPath)}`];
    },
    async exists() {
      try {
        await fs.access(diskPath(objectPath));
        return [true];
      } catch {
        return [false];
      }
    },
    async download() {
      return [await fs.readFile(diskPath(objectPath))];
    },
    async save(buffer, opts = {}) {
      await fs.mkdir(path.dirname(diskPath(objectPath)), { recursive: true });
      await fs.writeFile(diskPath(objectPath), buffer);
      await fs.writeFile(
        metaPath(objectPath),
        JSON.stringify({ contentType: opts.contentType || "application/octet-stream" }),
      );
    },
    async delete() {
      await fs.unlink(diskPath(objectPath)).catch(() => {});
      await fs.unlink(metaPath(objectPath)).catch(() => {});
    },
  };
}

export const localBucket = () => ({ file: localFile });

// Used directly by scripts/dev-api.mjs to serve /api/__local-storage/*.
export async function readLocalObject(objectPath) {
  const buffer = await fs.readFile(diskPath(objectPath));
  let contentType = "application/octet-stream";
  try {
    contentType = JSON.parse(await fs.readFile(metaPath(objectPath), "utf8")).contentType;
  } catch {
    // No sidecar — serve as opaque bytes.
  }
  return { buffer, contentType };
}

export const writeLocalObject = (objectPath, buffer, contentType) =>
  localFile(objectPath).save(buffer, { contentType });
