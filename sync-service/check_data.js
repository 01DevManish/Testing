const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function checkSQL() {
  console.log("\n--- 🗄️  SQL DATABASE (MySQL) ---");
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'eurus_erp'
  });

  try {
    const [tables] = await pool.query('SHOW TABLES');
    const tableList = tables.map(t => Object.values(t)[0]);
    console.log("Tables:", tableList.join(', '));

    for (const table of tableList) {
      const [count] = await pool.query(`SELECT COUNT(*) as cnt FROM ${table}`);
      console.log(`- ${table}: ${count[0].cnt} rows`);
    }
  } catch (e) {
    console.log("❌ SQL Error:", e.message);
  } finally {
    await pool.end();
  }
}

async function checkMongo() {
  console.log("\n--- 🍃 MONGODB (Mongoose) ---");
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const collections = await mongoose.connection.db.listCollections().toArray();
    const sortedColls = collections.map(c => c.name).sort();
    console.log("Collections:", sortedColls.join(', '));

    for (const collName of sortedColls) {
      const count = await mongoose.connection.db.collection(collName).countDocuments();
      console.log(`- ${collName}: ${count} docs`);
      
      const sample = await mongoose.connection.db.collection(collName).findOne();
      if (sample) {
        console.log(`  Preview: ${JSON.stringify(sample).substring(0, 100)}...`);
      }
    }
  } catch (e) {
    console.log("❌ MongoDB Error:", e.message);
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  console.log("📊 EURUS DATABASE STATUS");
  await checkSQL();
  await checkMongo();
  console.log("\n--- End of Report ---");
}

main();
