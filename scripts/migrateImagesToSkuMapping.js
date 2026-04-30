const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const admin = require("firebase-admin");
const {
  S3Client,
  CopyObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: path.join(process.cwd(), ".env") });
} else {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
  dotenv.config({ path: path.join(process.cwd(), ".env") });
}

const BACKUP_DIR = path.join(process.cwd(), "scripts", "backups");
const DB_URL =
  "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app/";

const bucket =
  process.env.AWS_S3_BUCKET_NAME ||
  process.env.NEXT_PUBLIC_AWS_S3_BUCKET ||
  "epanelimages";
const region =
  process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_S3_REGION || "ap-south-1";
const archivePrefix =
  process.env.NEXT_PUBLIC_S3_ARCHIVE_PREFIX ||
  "Cloudinary_Archive_2026-04-10_10_27_479_Originals/";
const inventoryPrefix = process.env.AWS_S3_PATH_PREFIX || "inventory/";

function log(...args) {
  console.log("[sku-image-migrate]", ...args);
}

function getLatestInventoryBackupPath() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^inventory-cost-backup-.*\.json$/.test(f))
    .sort();
  if (files.length === 0) return null;
  return path.join(BACKUP_DIR, files[files.length - 1]);
}

function buildServiceAccount() {
  const src = fs.readFileSync(
    path.join(process.cwd(), "scripts", "migrateLogs.js"),
    "utf8"
  );

  const projectId = (src.match(/project_id:\s*"([^"]+)"/) || [])[1];
  const privateKeyId = (src.match(/private_key_id:\s*"([^"]+)"/) || [])[1];
  const clientEmail = (src.match(/client_email:\s*"([^"]+)"/) || [])[1];
  const fallbackPk = (
    src.match(
      /private_key:\s*\(process\.env\.FIREBASE_PRIVATE_KEY \|\| "([\s\S]*?)"\)\.replace\(/
    ) || []
  )[1];

  if (!projectId || !privateKeyId || !clientEmail || !fallbackPk) {
    throw new Error("Could not parse Firebase credentials from scripts/migrateLogs.js");
  }

  return {
    type: "service_account",
    project_id: projectId,
    private_key_id: privateKeyId,
    private_key: (process.env.FIREBASE_PRIVATE_KEY || fallbackPk)
      .replace(/\\n/g, "\n")
      .trim(),
    client_email: clientEmail,
  };
}

function sanitizeSku(sku) {
  return String(sku || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function uniqStrings(values) {
  return Array.from(
    new Set(
      values
        .filter((v) => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    )
  );
}

function parseS3KeyFromUrl(url) {
  try {
    if (!url || typeof url !== "string") return null;
    if (url.includes(".amazonaws.com/")) {
      return url.split(".amazonaws.com/")[1].split("?")[0];
    }
    return null;
  } catch {
    return null;
  }
}

function parseArchiveKeyFromCloudinaryUrl(url) {
  try {
    if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) return null;
    const file = url.split("/").pop();
    if (!file) return null;
    return `${archivePrefix}${file}`.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function keyToPublicUrl(key) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function inferExtFromKey(key) {
  const file = String(key || "").split("/").pop() || "";
  const m = file.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "webp";
}

async function existsObject(s3, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyIfNeeded(s3, sourceKey, targetKey) {
  if (sourceKey === targetKey) return { copied: false, reason: "same-key" };
  if (await existsObject(s3, targetKey)) return { copied: false, reason: "exists" };

  const copySource = `${bucket}/${sourceKey}`
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource,
      Key: targetKey,
      MetadataDirective: "COPY",
    })
  );

  return { copied: true, reason: "copied" };
}

async function main() {
  const backupPath = getLatestInventoryBackupPath();
  if (!backupPath) throw new Error("No inventory-cost-backup file found in scripts/backups.");

  log("using backup", backupPath);
  const inventory = JSON.parse(fs.readFileSync(backupPath, "utf8"));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(buildServiceAccount()),
      databaseURL: DB_URL,
    });
  }

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  let scanned = 0;
  let eligible = 0;
  let copied = 0;
  let unchanged = 0;
  let skippedNoSku = 0;
  let skippedNoImage = 0;
  let unresolvedSource = 0;
  const dbUpdates = {};
  const skuMapUpdates = {};

  for (const [id, row] of Object.entries(inventory)) {
    scanned += 1;
    const skuRaw = String(row?.sku || "");
    const sku = sanitizeSku(skuRaw);
    if (!sku) {
      skippedNoSku += 1;
      continue;
    }

    const urls = uniqStrings([row?.imageUrl, ...(Array.isArray(row?.imageUrls) ? row.imageUrls : [])]);
    if (urls.length === 0) {
      skippedNoImage += 1;
      continue;
    }
    eligible += 1;

    const targetUrls = [];
    for (let i = 0; i < urls.length; i += 1) {
      const srcUrl = urls[i];
      const sourceKey =
        parseS3KeyFromUrl(srcUrl) || parseArchiveKeyFromCloudinaryUrl(srcUrl);
      if (!sourceKey) {
        unresolvedSource += 1;
        continue;
      }

      const ext = inferExtFromKey(sourceKey);
      const suffix = i === 0 ? "" : `-${i + 1}`;
      const targetKey = `${inventoryPrefix}images/${sku}${suffix}.${ext}`;
      const result = await copyIfNeeded(s3, sourceKey, targetKey);
      if (result.copied) copied += 1;
      else unchanged += 1;
      targetUrls.push(keyToPublicUrl(targetKey));
    }

    if (targetUrls.length > 0) {
      dbUpdates[`${id}/imageUrl`] = targetUrls[0];
      dbUpdates[`${id}/imageUrls`] = targetUrls;
      dbUpdates[`${id}/updatedAt`] = Date.now();

      skuMapUpdates[`${sku}`] = {
        productId: id,
        sku: skuRaw,
        urls: targetUrls,
        updatedAt: Date.now(),
      };
    }
  }

  log("pushing DB updates", Object.keys(dbUpdates).length);
  if (Object.keys(dbUpdates).length > 0) {
    await admin.database().ref("inventory").update(dbUpdates);
  }
  if (Object.keys(skuMapUpdates).length > 0) {
    await admin.database().ref("inventoryImageMap").update(skuMapUpdates);
  }

  const report = {
    bucket,
    region,
    backupPath,
    scanned,
    eligible,
    copied,
    unchanged,
    skippedNoSku,
    skippedNoImage,
    unresolvedSource,
    inventoryUpdates: Object.keys(dbUpdates).length,
    mappedSkus: Object.keys(skuMapUpdates).length,
    completedAt: new Date().toISOString(),
  };

  const reportPath = path.join(
    BACKUP_DIR,
    `sku-image-migration-report-${Date.now()}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  log("done", reportPath);
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
}

main().catch((err) => {
  console.error("[sku-image-migrate] failed:", err);
  process.exit(1);
});

