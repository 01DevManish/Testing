const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
require('dotenv').config();

// 1. Initialize Firebase
const serviceAccount = require('./service-account.json');

// Fix for PEM formatting (replacing literal \n with actual newlines)
if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
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

console.log("🚀 Eurus Sync Service Started...");

// ─── SYNC HELPERS ───

async function saveProduct(id, p) {
    if (!p) return;
    const query = `
      INSERT INTO products (id, name, category, collection, itemGroup, stock, price, status, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      name=?, category=?, collection=?, itemGroup=?, stock=?, price=?, status=?, updatedAt=?
    `;
    const values = [
      id, p.name, p.category, p.collection, p.itemGroup, p.stock, p.price, p.status, p.updatedAt,
      p.name, p.category, p.collection, p.itemGroup, p.stock, p.price, p.status, p.updatedAt
    ];
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (Product):", e.message); }
}

async function saveDispatch(id, o) {
    if (!o) return;
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
}

async function saveUser(id, u) {
    if (!u || u.email === '01devmanish@gmail.com') return; // Skip developer account
    const query = `
      INSERT INTO users (uid, name, email, role, permissions, dispatchPin)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      name=?, email=?, role=?, permissions=?, dispatchPin=?
    `;
    const values = [
      id, u.name, u.email, u.role, JSON.stringify(u.permissions || []), u.dispatchPin || '',
      u.name, u.email, u.role, JSON.stringify(u.permissions || []), u.dispatchPin || ''
    ];
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (User):", e.message); }
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
}

// ─── INITIAL SYNC ───

async function runInitialSync() {
    console.log("📥 Running Initial Sync (Historical Data Import)...");
    
    // 1. Sync Products
    const productsSnap = await db.ref('products').once('value');
    if (productsSnap.exists()) {
        const data = productsSnap.val();
        for (const id in data) await saveProduct(id, data[id]);
    }
    
    // 2. Sync Orders (Dispatches)
    const ordersSnap = await db.ref('orders').once('value');
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

    console.log("✅ Initial Sync Completed. Now listening for changes...");
}

// ─── REALTIME LISTENERS ───

function setupListeners() {
  // Products
  db.ref('products').on('child_added', (s) => saveProduct(s.key, s.val()));
  db.ref('products').on('child_changed', (s) => saveProduct(s.key, s.val()));
  db.ref('products').on('child_removed', async (s) => {
    try { await pool.execute('DELETE FROM products WHERE id = ?', [s.key]); } catch (e) {}
  });

  // Orders
  db.ref('orders').on('child_added', (s) => saveDispatch(s.key, s.val()));
  db.ref('orders').on('child_changed', (s) => saveDispatch(s.key, s.val()));
  db.ref('orders').on('child_removed', async (s) => {
    try { await pool.execute('DELETE FROM dispatches WHERE id = ?', [s.key]); } catch (e) {}
  });

  // Users
  db.ref('users').on('child_added', (s) => saveUser(s.key, s.val()));
  db.ref('users').on('child_changed', (s) => saveUser(s.key, s.val()));
  db.ref('users').on('child_removed', async (s) => {
    try { await pool.execute('DELETE FROM users WHERE uid = ?', [s.key]); } catch (e) {}
  });
  // Tasks
  db.ref('tasks').on('child_added', (s) => saveTask(s.key, s.val()));
  db.ref('tasks').on('child_changed', (s) => saveTask(s.key, s.val()));
  db.ref('tasks').on('child_removed', async (s) => {
    try { await pool.execute('DELETE FROM tasks WHERE id = ?', [s.key]); } catch (e) {}
  });
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
runInitialSync().then(() => {
    setupListeners();
    startCleanupJob();
});


// Error Handling
process.on('uncaughtException', (err) => {
  console.error("Critical Exception:", err);
});
