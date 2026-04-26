/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const {
  DynamoDBClient,
  DescribeTableCommand,
  CreateTableCommand,
  ScanCommand,
  BatchWriteItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketVersioningCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

const ENV_MAIN_PATH = path.join(process.cwd(), ".env");
const ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");

if (fs.existsSync(ENV_MAIN_PATH)) {
  dotenv.config({ path: ENV_MAIN_PATH, override: true });
}

const ENV_MAIN = fs.existsSync(ENV_MAIN_PATH) ? dotenv.parse(fs.readFileSync(ENV_MAIN_PATH, "utf8")) : {};
const ENV_LOCAL = fs.existsSync(ENV_LOCAL_PATH) ? dotenv.parse(fs.readFileSync(ENV_LOCAL_PATH, "utf8")) : {};

const REGION = process.env.AWS_REGION || "ap-south-1";
const PROD_TABLE = ENV_MAIN.DYNAMO_DATA_TABLE || "eurus-data";
const DEV_TABLE = process.env.DEV_DYNAMO_DATA_TABLE || ENV_LOCAL.DYNAMO_DATA_TABLE || "erpdev";
const PROD_BUCKET = ENV_MAIN.AWS_S3_BUCKET_NAME || "epanelimages";
const DEV_BUCKET_CANDIDATE =
  process.env.DEV_AWS_S3_BUCKET_NAME ||
  ENV_LOCAL.DEV_AWS_S3_BUCKET_NAME ||
  ENV_LOCAL.AWS_S3_BUCKET_NAME ||
  "erpdev";
const DEV_PREFIX = process.env.DEV_AWS_S3_PATH_PREFIX || "inventory/";

const makeConfig = () =>
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        region: REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : { region: REGION };

const ddb = new DynamoDBClient(makeConfig());
const s3 = new S3Client(makeConfig());

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const tableExists = async (tableName) => {
  try {
    await ddb.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (err) {
    if (String(err?.name || "").includes("ResourceNotFoundException")) return false;
    throw err;
  }
};

const ensureDevTable = async () => {
  const exists = await tableExists(DEV_TABLE);
  if (exists) {
    console.log(`[erpdev] Dynamo table exists: ${DEV_TABLE}`);
    return;
  }
  console.log(`[erpdev] Creating Dynamo table: ${DEV_TABLE}`);
  await ddb.send(
    new CreateTableCommand({
      TableName: DEV_TABLE,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "partition", AttributeType: "S" },
        { AttributeName: "timestamp_id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "partition", KeyType: "HASH" },
        { AttributeName: "timestamp_id", KeyType: "RANGE" },
      ],
    })
  );

  let ready = false;
  while (!ready) {
    await new Promise((r) => setTimeout(r, 2500));
    const desc = await ddb.send(new DescribeTableCommand({ TableName: DEV_TABLE }));
    ready = desc?.Table?.TableStatus === "ACTIVE";
  }
  console.log(`[erpdev] Dynamo table ready: ${DEV_TABLE}`);
};

const bucketExists = async (bucket) => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
};

const ensureDevBucket = async () => {
  if (await bucketExists(DEV_BUCKET_CANDIDATE)) {
    console.log(`[erpdev] S3 bucket exists: ${DEV_BUCKET_CANDIDATE}`);
    return DEV_BUCKET_CANDIDATE;
  }

  const bucketName = DEV_BUCKET_CANDIDATE;
  try {
    console.log(`[erpdev] Creating S3 bucket: ${bucketName}`);
    await s3.send(
      new CreateBucketCommand({
        Bucket: bucketName,
        CreateBucketConfiguration: { LocationConstraint: REGION },
      })
    );
  } catch (err) {
    const code = String(err?.name || "");
    if (code.includes("BucketAlreadyExists")) {
      throw new Error(
        `Requested dev bucket "${bucketName}" already exists in another AWS account. Set .env.local DEV_AWS_S3_BUCKET_NAME to your owned bucket and rerun.`
      );
    }
    if (!code.includes("BucketAlreadyOwnedByYou")) throw err;
  }

  await s3.send(
    new PutBucketVersioningCommand({
      Bucket: bucketName,
      VersioningConfiguration: { Status: "Enabled" },
    })
  );

  console.log(`[erpdev] S3 bucket ready: ${bucketName}`);
  return bucketName;
};

const scanAll = async (tableName) => {
  const items = [];
  let startKey;
  do {
    const out = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: startKey,
      })
    );
    items.push(...(out.Items || []));
    startKey = out.LastEvaluatedKey;
  } while (startKey);
  return items;
};

const copyDynamoAll = async () => {
  console.log(`[erpdev] Reading source table: ${PROD_TABLE}`);
  const sourceItems = await scanAll(PROD_TABLE);
  console.log(`[erpdev] Source items: ${sourceItems.length}`);

  const deleteReqs = [];
  const devItems = await scanAll(DEV_TABLE);
  devItems.forEach((item) => {
    deleteReqs.push({
      DeleteRequest: {
        Key: {
          partition: item.partition,
          timestamp_id: item.timestamp_id,
        },
      },
    });
  });

  for (const reqs of chunk(deleteReqs, 25)) {
    await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: { [DEV_TABLE]: reqs },
      })
    );
  }

  let written = 0;
  for (const reqs of chunk(
    sourceItems.map((item) => ({ PutRequest: { Item: item } })),
    25
  )) {
    await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: { [DEV_TABLE]: reqs },
      })
    );
    written += reqs.length;
  }
  console.log(`[erpdev] Copied items to ${DEV_TABLE}: ${written}`);
};

const listAllObjects = async (bucket) => {
  const keys = [];
  let token;
  do {
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
      })
    );
    (out.Contents || []).forEach((obj) => {
      if (obj.Key) keys.push(obj.Key);
    });
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
};

const objectExists = async (bucket, key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
};

const copyS3All = async (devBucket) => {
  console.log(`[erpdev] Reading source bucket: ${PROD_BUCKET}`);
  const keys = await listAllObjects(PROD_BUCKET);
  console.log(`[erpdev] Source objects: ${keys.length}`);
  let copied = 0;
  for (const key of keys) {
    const exists = await objectExists(devBucket, key);
    if (exists) continue;
    const copySource = `${PROD_BUCKET}/${key}`
      .split("/")
      .map((p) => encodeURIComponent(p))
      .join("/");
    await s3.send(
      new CopyObjectCommand({
        Bucket: devBucket,
        Key: key,
        CopySource: copySource,
        MetadataDirective: "COPY",
      })
    );
    copied += 1;
    if (copied % 100 === 0) {
      console.log(`[erpdev] Copied ${copied}/${keys.length} objects`);
    }
  }
  console.log(`[erpdev] S3 copy complete. New copied: ${copied}, total checked: ${keys.length}`);
};

const upsertEnvLocal = (devBucket) => {
  const envLocalPath = path.join(process.cwd(), ".env.local");
  const existing = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf8") : "";
  const map = new Map();

  existing
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx <= 0) return;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      map.set(k, v);
    });

  map.set("DYNAMO_DATA_TABLE", DEV_TABLE);
  map.set("DEV_AWS_S3_BUCKET_NAME", devBucket);
  map.set("AWS_S3_BUCKET_NAME", devBucket);
  map.set("NEXT_PUBLIC_AWS_S3_BUCKET", devBucket);
  map.set("BACKUP_S3_BUCKET", devBucket);
  map.set("AWS_S3_PATH_PREFIX", DEV_PREFIX);
  map.set("NEXT_PUBLIC_ENABLE_REALTIME_WS", "false");

  const out = Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  fs.writeFileSync(envLocalPath, `${out}\n`, "utf8");
  console.log(`[erpdev] Local overrides written: ${envLocalPath}`);
};

async function main() {
  console.log("[erpdev] Setup started");
  console.log(`[erpdev] region=${REGION}, prodTable=${PROD_TABLE}, devTable=${DEV_TABLE}`);
  console.log(`[erpdev] prodBucket=${PROD_BUCKET}, devBucketCandidate=${DEV_BUCKET_CANDIDATE}`);

  await ensureDevTable();
  const devBucket = await ensureDevBucket();
  await copyDynamoAll();
  await copyS3All(devBucket);
  upsertEnvLocal(devBucket);

  console.log("[erpdev] Setup completed");
  console.log(
    JSON.stringify(
      {
        devTable: DEV_TABLE,
        devBucket,
        envLocalOverrides: [
          "DYNAMO_DATA_TABLE",
          "AWS_S3_BUCKET_NAME",
          "NEXT_PUBLIC_AWS_S3_BUCKET",
          "BACKUP_S3_BUCKET",
          "AWS_S3_PATH_PREFIX",
          "NEXT_PUBLIC_ENABLE_REALTIME_WS",
        ],
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("[erpdev] Setup failed", err);
  process.exit(1);
});
