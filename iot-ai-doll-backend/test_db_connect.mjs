import { query } from "./src/db/pool.js";
query("SELECT 1 as test").then(r => { console.log("DB OK:", JSON.stringify(r.rows)); process.exit(0); }).catch(e => { console.error("DB FAIL:", e.message); process.exit(1); });
