const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
require('dotenv').config();

// 1. Initialize Firebase
// Make sure you place your service-account.json in the same folder
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://eurus-lifestyle-default-rtdb.firebaseio.com" 
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

// ─── SYNC LOGIC ───

// Sync Function for Products
function syncProducts() {
  const ref = db.ref('products');
  
  ref.on('child_added', async (snapshot) => {
    const p = snapshot.val();
    const id = snapshot.key;
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
    
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (Add):", e.message); }
  });

  ref.on('child_changed', async (snapshot) => {
    const p = snapshot.val();
    const id = snapshot.key;
    if (!p) return;
    
    const query = `
      UPDATE products SET 
      name=?, category=?, collection=?, itemGroup=?, stock=?, price=?, status=?, updatedAt=?
      WHERE id=?
    `;
    const values = [p.name, p.category, p.collection, p.itemGroup, p.stock, p.price, p.status, p.updatedAt, id];
    
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (Update):", e.message); }
  });

  ref.on('child_removed', async (snapshot) => {
    const id = snapshot.key;
    try { await pool.execute('DELETE FROM products WHERE id = ?', [id]); } catch (e) { console.error("SQL Error (Delete):", e.message); }
  });
}

// Sync Function for Dispatches (Orders)
function syncDispatches() {
  const ref = db.ref('orders');
  
  ref.on('child_added', async (snapshot) => {
    const o = snapshot.val();
    const id = snapshot.key;
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
    
    try { await pool.execute(query, values); } catch (e) { console.error("SQL Error (Dispatch Add):", e.message); }
  });

  ref.on('child_changed', async (snapshot) => {
    const o = snapshot.val();
    const id = snapshot.key;
    const query = `UPDATE dispatches SET partyName=?, transporterName=?, bails=?, status=?, updatedAt=? WHERE id=?`;
    try { await pool.execute(query, [o.partyName, o.transporterName, o.bails, o.status, o.updatedAt, id]); } catch (e) { console.error("SQL Error (Dispatch Update):", e.message); }
  });

  ref.on('child_removed', async (snapshot) => {
    const id = snapshot.key;
    try { await pool.execute('DELETE FROM dispatches WHERE id = ?', [id]); } catch (e) { console.error("SQL Error (Dispatch Delete):", e.message); }
  });
}

// Start Listeners
syncProducts();
syncDispatches();

// Error Handling
process.on('uncaughtException', (err) => {
  console.error("Critical Exception:", err);
});
