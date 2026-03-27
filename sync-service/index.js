const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

// 1. Initialize Firebase
// 1. Initialize Firebase
const serviceAccount = require('./service-account.json');

// Aggressive PEM Reformatting (fixes common copy-paste issues)
if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";
  
  if (serviceAccount.private_key.includes(header) && serviceAccount.private_key.includes(footer)) {
    const base64Body = serviceAccount.private_key
      .replace(header, "")
      .replace(footer, "")
      .replace(/[^A-Za-z0-9+/=]/g, ""); // Remove EVERYTHING except base64 chars
    
    // Reconstruct with proper 64-character PEM lines
    const match = base64Body.match(/.{1,64}/g);
    serviceAccount.private_key = `${header}\n${match.join('\n')}\n${footer}\n`;
    // fs.writeFileSync('debug_key.pem', serviceAccount.private_key); // Removed debug
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL || "https://eurus-lifestyle-default-rtdb.firebaseio.com"
});

const db = admin.database();

// 2. SQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'eurus_erp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 3. Mongoose Connection & Schemas
const flexibleSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Product = mongoose.model('Product', flexibleSchema);
const Brand = mongoose.model('Brand', flexibleSchema);
const Dispatch = mongoose.model('Dispatch', flexibleSchema);
const User = mongoose.model('User', flexibleSchema);
const Task = mongoose.model('Task', flexibleSchema);
const PartyRate = mongoose.model('PartyRate', flexibleSchema);
const Party = mongoose.model('Party', flexibleSchema);
const Category = mongoose.model('Category', flexibleSchema);
const Collection = mongoose.model('Collection', flexibleSchema);
const Activity = mongoose.model('Activity', flexibleSchema);

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB (Mongoose) Connected.");
  } catch (e) {
    console.error("❌ Mongoose Connection Error:", e.message);
  }
}

// Ensure party_rates table exists
async function createSQLTables() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS party_rates (
      id VARCHAR(255) PRIMARY KEY,
      partyName VARCHAR(255) NOT NULL,
      rates JSON,
      updatedAt BIGINT
    );
  `;
  try {
    await pool.execute(createTableQuery);
    console.log("✅ party_rates table ensured.");
  } catch (e) {
    console.error("❌ Error creating party_rates table:", e.message);
  }
}

console.log("🚀 Eurus Sync Service Started...");

// ─── SYNC HELPERS ───

async function saveProduct(id, p) {
    if (!p) return;
    // SQL
    const query = `
      INSERT INTO products (id, name, sku, category, collection, brand, brand_id, stock, price, status, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      name=?, sku=?, category=?, collection=?, brand=?, brand_id=?, stock=?, price=?, status=?, updatedAt=?
    `;
    const values = [
      id, p.productName || p.name, p.sku || '', p.category, p.collection || '', p.brand || '', p.brandId || '', p.stock, p.price, p.status, p.updatedAt,
      p.productName || p.name, p.sku || '', p.category, p.collection || '', p.brand || '', p.brandId || '', p.stock, p.price, p.status, p.updatedAt
    ];
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (Product):", e.message); }

    // MongoDB (Mongoose)
    try {
      await Product.replaceOne({ id }, { ...p, id, updatedAt: p.updatedAt || Date.now() }, { upsert: true });
    } catch (e) { console.error("Mongo Error (Product):", e.message); }
}

async function saveBrand(id, b) {
    if (!b) return;
    // SQL
    const query = `
      INSERT INTO brands (id, name, logoUrl, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      name=?, logoUrl=?, updatedAt=?
    `;
    const values = [
      id, b.name, b.logoUrl, b.createdAt, b.updatedAt || Date.now(),
      b.name, b.logoUrl, b.updatedAt || Date.now()
    ];
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (Brand):", e.message); }

    // MongoDB (Mongoose)
    try {
      await Brand.replaceOne({ id }, { ...b, id }, { upsert: true });
    } catch (e) { console.error("Mongo Error (Brand):", e.message); }
}

async function saveDispatch(id, o) {
    if (!o) return;
    // SQL
    const query = `
      INSERT INTO dispatches (id, partyName, transporterName, bails, status, paymentStatus, dispatchDate, remarks, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      partyName=?, transporterName=?, bails=?, status=?, paymentStatus=?, dispatchDate=?, remarks=?, updatedAt=?
    `;
    const values = [
      id, o.partyName, o.transporterName, o.bails, o.status, o.paymentStatus, o.dispatchDate, o.remarks, o.createdAt, o.updatedAt,
      o.partyName, o.transporterName, o.bails, o.status, o.paymentStatus, o.dispatchDate, o.remarks, o.updatedAt
    ];
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (Dispatch):", e.message); }

    // MongoDB (Mongoose)
    try {
      await Dispatch.replaceOne({ id }, { ...o, id }, { upsert: true });
    } catch (e) { console.error("Mongo Error (Dispatch):", e.message); }
}

async function saveUser(id, u) {
    if (!u || u.email === '01devmanish@gmail.com') return;
    // SQL
    const query = `
      INSERT INTO users (uid, name, email, role, permissions, dispatchPin, profilePic)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      name=?, email=?, role=?, permissions=?, dispatchPin=?, profilePic=?
    `;
    const values = [
      id, u.name, u.email, u.role, JSON.stringify(u.permissions || []), u.dispatchPin || '', u.profilePic || null,
      u.name, u.email, u.role, JSON.stringify(u.permissions || []), u.dispatchPin || '', u.profilePic || null
    ];
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (User):", e.message); }

    // MongoDB (Mongoose)
    try {
      await User.replaceOne({ uid: id }, { ...u, uid: id }, { upsert: true });
    } catch (e) { console.error("Mongo Error (User):", e.message); }
}
async function saveTask(id, t) {
    if (!t) return;
    const query = `
      INSERT INTO tasks (id, title, description, assignedTo, assignedToName, assignedToRole, priority, status, createdAt, expiresAt, completedAt, createdBy, createdByName, attachments, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      title=?, description=?, assignedTo=?, assignedToName=?, assignedToRole=?, priority=?, status=?, expiresAt=?, completedAt=?, createdByName=?, attachments=?, updatedAt=?
    `;
    const now = Date.now();
    const values = [
      id, t.title, t.description, t.assignedTo, t.assignedToName, t.assignedToRole, t.priority, t.status, t.createdAt, t.expiresAt, t.completedAt || null, t.createdBy, t.createdByName, JSON.stringify(t.attachments || []), now,
      t.title, t.description, t.assignedTo, t.assignedToName, t.assignedToRole, t.priority, t.status, t.expiresAt, t.completedAt || null, t.createdByName, JSON.stringify(t.attachments || []), now
    ];
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (Task):", e.message); }

    // MongoDB (Mongoose)
    try {
      await Task.replaceOne({ id }, { ...t, id }, { upsert: true });
    } catch (e) { console.error("Mongo Error (Task):", e.message); }
}

async function savePartyRate(id, pr) {
    if (!pr) return;
    // SQL
    const query = `
      INSERT INTO party_rates (id, partyName, rates, updatedAt)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      partyName=?, rates=?, updatedAt=?
    `;
    const ratesJson = JSON.stringify(pr.rates || []);
    const values = [
      id, pr.partyName, ratesJson, pr.updatedAt || Date.now(),
      pr.partyName, ratesJson, pr.updatedAt || Date.now()
    ];
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (PartyRate):", e.message); }

    // MongoDB (Mongoose)
    try {
      await PartyRate.replaceOne({ id }, { ...pr, id }, { upsert: true });
    } catch (e) { console.error("Mongo Error (PartyRate):", e.message); }
}


async function saveParty(id, p) {
    if (!p) return;
    try { await Party.replaceOne({ id }, { ...p, id }, { upsert: true }); } catch (e) { console.error("Mongo Error (Party):", e.message); }
}
async function saveCategory(id, c) {
    if (!c) return;
    try { await Category.replaceOne({ id }, { ...c, id }, { upsert: true }); } catch (e) { console.error("Mongo Error (Category):", e.message); }
}
async function saveCollection(id, c) {
    if (!c) return;
    try { await Collection.replaceOne({ id }, { ...c, id }, { upsert: true }); } catch (e) { console.error("Mongo Error (Collection):", e.message); }
}
async function saveActivity(id, a) {
    if (!a) return;
    try { await Activity.replaceOne({ id }, { ...a, id }, { upsert: true }); } catch (e) { console.error("Mongo Error (Activity):", e.message); }
}

// ─── INITIAL SYNC ───

async function runInitialSync() {
    console.log("📥 Running Initial Sync (Historical Data Import)...");
    
    // 1. Sync Products (from 'inventory')
    const productsSnap = await db.ref('inventory').once('value');
    if (productsSnap.exists()) {
        const data = productsSnap.val();
        for (const id in data) await saveProduct(id, data[id]);
    }
    
    // 2. Sync Orders (from 'dispatches')
    const ordersSnap = await db.ref('dispatches').once('value');
    if (ordersSnap.exists()) {
        const data = ordersSnap.val();
        for (const id in data) await saveDispatch(id, data[id]);
    }

    // 3. Sync Users
    const usersSnap = await db.ref('users').once('value');
    if (usersSnap.exists()) {
        const data = usersSnap.val();
        for (const id in data) await saveUser(id, data[id]);
    }

    // 4. Sync Tasks
    const tasksSnap = await db.ref('tasks').once('value');
    if (tasksSnap.exists()) {
        const data = tasksSnap.val();
        for (const id in data) await saveTask(id, data[id]);
    }

    // 5. Sync Party Rates
    const partyRatesSnap = await db.ref('partyRates').once('value');
    if (partyRatesSnap.exists()) {
        const data = partyRatesSnap.val();
        for (const id in data) await savePartyRate(id, data[id]);
    }

    // 6. Sync Brands
    const brandsSnap = await db.ref('brands').once('value');
    if (brandsSnap.exists()) {
        const data = brandsSnap.val();
        for (const id in data) await saveBrand(id, data[id]);
    }

    // 7. Sync Parties
    const partiesSnap = await db.ref('parties').once('value');
    if (partiesSnap.exists()) {
        const data = partiesSnap.val();
        for (const id in data) await saveParty(id, data[id]);
    }

    // 8. Sync Categories
    const categoriesSnap = await db.ref('categories').once('value');
    if (categoriesSnap.exists()) {
        const data = categoriesSnap.val();
        for (const id in data) await saveCategory(id, data[id]);
    }

    // 9. Sync Collections
    const collectionsSnap = await db.ref('collections').once('value');
    if (collectionsSnap.exists()) {
        const data = collectionsSnap.val();
        for (const id in data) await saveCollection(id, data[id]);
    }

    // 10. Sync Activities
    const activitiesSnap = await db.ref('activities').once('value');
    if (activitiesSnap.exists()) {
        const data = activitiesSnap.val();
        for (const id in data) await saveActivity(id, data[id]);
    }

    console.log("✅ Initial Sync Completed. Now listening for changes...");
}

// ─── REALTIME LISTENERS ───

function setupListeners() {
  // Products (inventory)
  db.ref('inventory').on('child_added', (s) => saveProduct(s.key, s.val()));
  db.ref('inventory').on('child_changed', (s) => saveProduct(s.key, s.val()));
  db.ref('inventory').on('child_removed', async (s) => {
    try { await pool.execute('DELETE FROM products WHERE id = ?', [s.key]); } catch (e) {}
    try { await Product.deleteOne({ id: s.key }); } catch (e) {}
  });

  // Orders (dispatches)
  db.ref('dispatches').on('child_added', (s) => saveDispatch(s.key, s.val()));
  db.ref('dispatches').on('child_changed', (s) => saveDispatch(s.key, s.val()));
  db.ref('dispatches').on('child_removed', async (s) => {
    try { await pool.execute('DELETE FROM dispatches WHERE id = ?', [s.key]); } catch (e) {}
    try { await Dispatch.deleteOne({ id: s.key }); } catch (e) {}
  });

  // Users
  db.ref('users').on('child_added', (s) => saveUser(s.key, s.val()));
  db.ref('users').on('child_changed', (s) => saveUser(s.key, s.val()));
  db.ref('users').on('child_removed', async (s) => {
    try { await pool.execute('DELETE FROM users WHERE uid = ?', [s.key]); } catch (e) {}
    try { await User.deleteOne({ uid: s.key }); } catch (e) {}
  });

  // Party Rates
  db.ref('partyRates').on('child_added', (s) => savePartyRate(s.key, s.val()));
  db.ref('partyRates').on('child_changed', (s) => savePartyRate(s.key, s.val()));
  db.ref('partyRates').on('child_removed', async (s) => {
    try { await pool.execute('DELETE FROM party_rates WHERE id = ?', [s.key]); } catch (e) {}
    try { await PartyRate.deleteOne({ id: s.key }); } catch (e) {}
  });

  // Brands
  db.ref('brands').on('child_added', (s) => saveBrand(s.key, s.val()));
  db.ref('brands').on('child_changed', (s) => saveBrand(s.key, s.val()));
  db.ref('brands').on('child_removed', async (s) => {
    try { await pool.execute('DELETE FROM brands WHERE id = ?', [s.key]); } catch (e) {}
    try { await Brand.deleteOne({ id: s.key }); } catch (e) {}
  });

  // New Nodes (Parties, Categories, Collections, Activities)
  db.ref('parties').on('child_added', (s) => saveParty(s.key, s.val()));
  db.ref('parties').on('child_changed', (s) => saveParty(s.key, s.val()));
  db.ref('parties').on('child_removed', (s) => Party.deleteOne({ id: s.key }));

  db.ref('categories').on('child_added', (s) => saveCategory(s.key, s.val()));
  db.ref('categories').on('child_changed', (s) => saveCategory(s.key, s.val()));
  db.ref('categories').on('child_removed', (s) => Category.deleteOne({ id: s.key }));

  db.ref('collections').on('child_added', (s) => saveCollection(s.key, s.val()));
  db.ref('collections').on('child_changed', (s) => saveCollection(s.key, s.val()));
  db.ref('collections').on('child_removed', (s) => Collection.deleteOne({ id: s.key }));

  db.ref('activities').on('child_added', (s) => saveActivity(s.key, s.val()));
  db.ref('activities').on('child_changed', (s) => saveActivity(s.key, s.val()));
}



// ─── TTL CLEANUP ───

async function startCleanupJob() {
  console.log("⏰ Starting TTL Cleanup Job (72h Tasks)...");
  
  const cleanup = async () => {
    const now = Date.now();
    try {
      const tasksSnap = await db.ref('tasks').once('value');
      if (!tasksSnap.exists()) return;
      
      const tasks = tasksSnap.val();
      let deletedCount = 0;
      
      for (const id in tasks) {
        const task = tasks[id];
        if (task.expiresAt && task.expiresAt < now) {
          console.log(`🗑️ Deleting expired task: ${id} (${task.title})`);
          await db.ref(`tasks/${id}`).remove();
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`✅ Cleanup finished. Deleted ${deletedCount} expired tasks.`);
      }
    } catch (e) {
      console.error("❌ Cleanup Error:", e.message);
    }
  };

  // Run immediately then every hour
  cleanup();
  setInterval(cleanup, 60 * 60 * 1000); 
}

// Start sequence
connectMongo().then(() => {
  createSQLTables().then(() => {
      runInitialSync().then(() => {
          setupListeners();
          startCleanupJob();
      });
  });
});



// Error Handling
process.on('uncaughtException', (err) => {
  console.error("Critical Exception:", err);
});
