const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// Reformat private key if needed (common in this codebase)
if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";
  if (serviceAccount.private_key.includes(header) && serviceAccount.private_key.includes(footer)) {
    const base64Body = serviceAccount.private_key
      .replace(header, "").replace(footer, "").replace(/[^A-Za-z0-9+/=]/g, "");
    const match = base64Body.match(/.{1,64}/g);
    serviceAccount.private_key = `${header}\n${match.join('\n')}\n${footer}\n`;
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app/"
});

const db = admin.database();

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  gray: "\x1b[90m"
};

function formatRow(sku, name, price, stock, category) {
  const s = sku.padEnd(10).substring(0, 10);
  const n = name.padEnd(35).substring(0, 35);
  const p = ("₹" + price).padEnd(10);
  const st = (stock + " pcs").padEnd(10);
  const cat = category.padEnd(15).substring(0, 15);
  
  return `${colors.yellow}${s}${colors.reset} | ${colors.bright}${n}${colors.reset} | ${colors.green}${p}${colors.reset} | ${colors.magenta}${st}${colors.reset} | ${colors.cyan}${cat}${colors.reset}`;
}

async function showData() {
  let type = 'inventory';
  let limit = 10;

  // Smart argument parsing
  const arg1 = process.argv[2];
  const arg2 = process.argv[3];

  if (arg1) {
    if (!isNaN(parseInt(arg1))) {
      limit = parseInt(arg1);
    } else {
      type = arg1.toLowerCase();
      // Auto-pluralize and mapping
      if (type === 'user') type = 'users';
      if (type === 'product' || type === 'inventory' || type === 'inv') type = 'inventory';
      if (type === 'category') type = 'categories';
      if (type === 'collection') type = 'collections';
      if (type === 'brand') type = 'brands';
      if (type === 'dispatch' || type === 'order') type = 'dispatches';
      
      if (arg2 && !isNaN(parseInt(arg2))) {
        limit = parseInt(arg2);
      }
    }
  }
  
  if (type === 'users') {
    console.log(`\n${colors.bright}${colors.red}=== EURUS USERS (Limit: ${limit}) ===${colors.reset}\n`);
    const snap = await db.ref('users').limitToFirst(limit).once('value');
    if (snap.exists()) {
      const data = snap.val();
      console.log(`${colors.gray}${"Name".padEnd(20)} | ${"Email".padEnd(30)} | ${"Role"}${colors.reset}`);
      console.log(`${colors.gray}${"-".repeat(70)}${colors.reset}`);
      Object.keys(data).forEach(key => {
        const u = data[key];
        if (u.email === "01devmanish@gmail.com") return;
        const name = (u.name || "N/A").padEnd(20).substring(0, 20);
        const email = (u.email || "N/A").padEnd(30).substring(0, 30);
        const role = (u.role || "employee").toUpperCase();
        console.log(`${name} | ${email} | ${colors.green}${role}${colors.reset}`);
      });
    } else { console.log("No data found."); }

  } else if (type === 'dispatches') {
    console.log(`\n${colors.bright}${colors.magenta}=== EURUS DISPATCHES (Limit: ${limit}) ===${colors.reset}\n`);
    const snap = await db.ref('dispatches').limitToFirst(limit).once('value');
    if (snap.exists()) {
      const data = snap.val();
      console.log(`${colors.gray}${"ID".padEnd(10)} | ${"Party Name".padEnd(25)} | ${"Status".padEnd(12)}${colors.reset}`);
      console.log(`${colors.gray}${"-".repeat(50)}${colors.reset}`);
      Object.keys(data).forEach(key => {
        const o = data[key];
        const id = key.substring(0, 8).padEnd(10);
        const party = (o.partyName || "N/A").padEnd(25).substring(0, 25);
        const status = (o.status || "PENDING").padEnd(12);
        console.log(`${colors.yellow}${id}${colors.reset} | ${colors.bright}${party}${colors.reset} | ${colors.cyan}${status}${colors.reset}`);
      });
    } else { console.log("No data found."); }

  } else if (type === 'categories' || type === 'collections' || type === 'brands') {
    console.log(`\n${colors.bright}${colors.cyan}=== EURUS ${type.toUpperCase()} (Limit: ${limit}) ===${colors.reset}\n`);
    const snap = await db.ref(type).limitToFirst(limit).once('value');
    if (snap.exists()) {
      const data = snap.val();
      console.log(`${colors.gray}${"ID".padEnd(12)} | ${"Name/Title"}${colors.reset}`);
      console.log(`${colors.gray}${"-".repeat(40)}${colors.reset}`);
      Object.keys(data).forEach(key => {
        const item = data[key];
        const name = item.name || item.title || item.productName || "N/A";
        console.log(`${colors.yellow}${key.substring(0, 10).padEnd(12)}${colors.reset} | ${colors.bright}${name}${colors.reset}`);
      });
    } else { console.log("No data found."); }

  } else {
    // Default or Inventory
    const node = type === 'inventory' ? 'inventory' : type; // Try any node name
    console.log(`\n${colors.bright}${colors.cyan}=== EURUS ${node.toUpperCase()} (Limit: ${limit}) ===${colors.reset}\n`);
    const snap = await db.ref(node).limitToFirst(limit).once('value');
    if (snap.exists()) {
      const data = snap.val();
      if (node === 'inventory') {
        console.log(`${colors.gray}${"SKU".padEnd(10)} | ${"Product Name".padEnd(35)} | ${"Price".padEnd(8)} | ${"Stock"}${colors.reset}`);
        console.log(`${colors.gray}${"-".repeat(70)}${colors.reset}`);
        Object.keys(data).forEach(key => {
          const item = data[key];
          console.log(formatRow(item.sku || "N/A", item.productName || item.name || "N/A", item.price || 0, item.stock || 0, ""));
        });
      } else {
        // Generic Raw view
        console.log(JSON.stringify(data, null, 2));
      }
    } else {
      console.log(`No data found in node: '${node}'`);
    }
  }
  console.log("\n");
  process.exit(0);
}

showData().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
