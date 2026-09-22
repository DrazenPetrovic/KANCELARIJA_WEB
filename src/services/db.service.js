import mysql from "mysql2/promise";
import { dbConfig } from "../config/db.js";

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Bez ovoga mysql2 vraća DATE/DATETIME/TIMESTAMP kao JS Date objekte, koji
  // se pri JSON serijalizaciji (res.json) automatski pretvaraju u UTC
  // (toISOString) — to pomjera prikazano vrijeme za razliku vremenske zone
  // servera (npr. upisanih 06:30 lokalno prikazuje se kao 04:30 na UTC+2).
  // dateStrings vraća tačan string iz baze bez ikakve konverzije zone.
  dateStrings: true,
});

// Helper: uzme konekciju iz pool-a, vrati je nazad kad završi
export const withConnection = async (fn) => {
  const connection = await pool.getConnection();
  try {
    return await fn(connection);
  } finally {
    connection.release();
  }
};
