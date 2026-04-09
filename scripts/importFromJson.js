const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * 📥 Local JSON to Firestore Importer
 * ---------------------------------
 * Imports data from a local JSON file (RTDB Export) into Firestore.
 */

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
const JSON_DATA_PATH = path.join(__dirname, 'rtdb_import.json'); // 👈 Your JSON file

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ Error: service-account.json not found.");
  process.exit(1);
}

if (!fs.existsSync(JSON_DATA_PATH)) {
  console.error("❌ Error: rtdb_import.json not found.");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
const jsonData = require(JSON_DATA_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

function sanitizeData(data) {
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item)).filter(item => item !== undefined);
  } else if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    Object.entries(data).forEach(([key, value]) => {
      const sanitizedValue = sanitizeData(value);
      if (sanitizedValue !== undefined && sanitizedValue !== null) {
        sanitized[key] = sanitizedValue;
      }
    });
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }
  return data;
}

async function migrateDocument(collectionName, docId, docData, bulkWriter) {
  const docRef = firestore.collection(collectionName).doc(docId);
  
  if (collectionName === "chats" && docData.messages) {
    const { messages, ...chatMeta } = docData;
    bulkWriter.set(docRef, sanitizeData(chatMeta) || {});
    Object.entries(messages).forEach(([msgId, msgData]) => {
      const msgRef = docRef.collection("messages").doc(msgId);
      bulkWriter.set(msgRef, sanitizeData(msgData));
    });
  } else {
    const sanitized = sanitizeData(docData);
    if (sanitized) bulkWriter.set(docRef, sanitized);
  }
}

async function startImport() {
  console.log("🚀 Starting Import from JSON file...");
  const bulkWriter = firestore.bulkWriter();
  let totalDocs = 0;

  for (const [collectionName, collectionData] of Object.entries(jsonData)) {
    console.log(`📦 Importing Collection: [${collectionName}]`);
    const entries = Object.entries(collectionData);
    
    for (const [docId, docData] of entries) {
      await migrateDocument(collectionName, docId, docData, bulkWriter);
      totalDocs++;
    }
  }

  await bulkWriter.close();
  console.log(`\n🏁 Import Completed! Total Documents: ${totalDocs}`);
  process.exit(0);
}

startImport().catch(console.error);
