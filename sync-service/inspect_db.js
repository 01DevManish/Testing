const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'eurus_erp',
    });

    try {
        console.log("--- 📊 DATABASE INSPECTION (eurus_erp) ---");

        // 1. List Tables
        const [tables] = await pool.query('SHOW TABLES');
        const tableList = tables.map(t => Object.values(t)[0]);
        console.log("\nTables found:", tableList.join(', '));

        for (const tableName of tableList) {
            const [countRes] = await pool.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
            console.log(`\nTable: ${tableName} (${countRes[0].cnt} rows)`);
            
            const [sample] = await pool.query(`SELECT * FROM ${tableName} LIMIT 5`);
            if (sample.length > 0) {
                // Formatting for readability since console.table might be cut off
                sample.forEach((row, i) => {
                    console.log(`[Row ${i+1}]:`, JSON.stringify(row).substring(0, 150) + "...");
                });
            } else {
                console.log(" (Empty)");
            }
        }

    } catch (e) {
        console.error("❌ DB Error:", e.message);
    } finally {
        await pool.end();
    }
}

main();
