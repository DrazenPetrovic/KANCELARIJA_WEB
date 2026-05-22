import mysql from "mysql2/promise";
import { dbConfig } from "../config/db.js";

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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
