import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import * as dotenv from "dotenv";
import { SCHEMA } from "../lib/db";

dotenv.config({ path: ".env.local" });

neonConfig.webSocketConstructor = ws as any;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(SCHEMA);
    console.log("✓ Neon schema initialized successfully!");
  } catch (e: any) {
    console.error("✗ Schema init failed:", e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
