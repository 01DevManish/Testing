const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * 🛠️ Firebase RTDB to Firestore Migration Script
 * -----------------------------------------------
 * This script performs a safe, read-only copy of data from 
 * Realtime Database to Cloud Firestore. 
 *
 * Requirements:
 * 1. service-account.json (Download from Firebase Console)
 * 2. Node.js environment
 */

// 1. configuration
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
const DATABASE_URL = "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app"; // 👈 Your Regional URL

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ Error: service-account.json not found in root directory.");
  console.error("Please download it from Firebase Console > Project Settings > Service Accounts.");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL
});

const db = admin.database();
const firestore = admin.firestore();

// 2. Collections to migrate (Top-level nodes in RTDB)
const COLLECTIONS_TO_MIGRATE = [
  "activities",
  "brands",
  "categories",
  "chats",
  "collections",
  "dispatches",
  "inventory",
  "notifications",
  "packingLists",
  "partyRates",
  "tasks",
  "test_write",
  "user_chats",
  "users"
];

/**
 * 🧹 Sanitizes data for Firestore
 * - Removes null/undefined
 * - Handles nested objects
 */
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

/**
 * 🚀 Migrates a single document and its potential subcollections
 * Handles the "Tree to Collection/Document/Subcollection" mapping.
 */
async function migrateDocument(collectionName, docId, docData, bulkWriter) {
  const docRef = firestore.collection(collectionName).doc(docId);
  
  // Specific logic for 'chats' or 'user_chats' to manage large message trees as subcollections
  if ((collectionName === "chats" || collectionName === "user_chats") && docData.messages) {
    const { messages, ...metaData } = docData;
    
    // Set the metadata document
    bulkWriter.set(docRef, sanitizeData(metaData) || {});
    
    // Set the messages subcollection documents (preserves IDs)
    Object.entries(messages).forEach(([msgId, msgData]) => {
      const msgRef = docRef.collection("messages").doc(msgId);
      bulkWriter.set(msgRef, sanitizeData(msgData));
    });
  } else {
    // Default migration logic for all other collections
    const sanitized = sanitizeData(docData);
    if (sanitized) {
      bulkWriter.set(docRef, sanitized);
    }
  }
}

/**
 * 🚀 Main Migration Logic
 */
async function migrate() {
  console.log("🚀 Starting Migration: RTDB -> Firestore...");
  
  // Use BulkWriter for high-performance, rate-limited writes
  const bulkWriter = firestore.bulkWriter();
  bulkWriter.onWriteError((error) => {
    console.error(`❌ Write failed: ${error.getMessage()}`);
    return true; // Retry
  });

  let totalDocs = 0;

  for (const collectionName of COLLECTIONS_TO_MIGRATE) {
    console.log(`\n📦 Processing Collection: [${collectionName}]`);
    
    try {
      const snapshot = await db.ref(collectionName).once('value');
      const data = snapshot.val();

      if (!data) {
        console.log(`ℹ️ No data found in ${collectionName}. Skipping.`);
        continue;
      }

      const entries = Object.entries(data);
      console.log(`📄 Found ${entries.length} units to migrate in ${collectionName}.`);

      for (const [docId, docData] of entries) {
        await migrateDocument(collectionName, docId, docData, bulkWriter);
        totalDocs++;
        
        if (totalDocs % 50 === 0) {
          console.log(`✅ Progress: ${totalDocs} documents prepared...`);
        }
      }
    } catch (error) {
      console.error(`❌ Error migrating ${collectionName}:`, error.message);
    }
  }

  console.log("\n⏳ Finalizing writes to Firestore. Please wait...");
  await bulkWriter.close();
  
  console.log("\n===============================================");
  console.log(`🏁 Migration Completed Successfully!`);
  console.log(`📊 Total Documents Migrated: ${totalDocs}`);
  console.log("===============================================");
  process.exit(0);
}

// Start the migration
migrate().catch(err => {
  console.error("💥 Fatal Migration Error:", err);
  process.exit(1);
});
