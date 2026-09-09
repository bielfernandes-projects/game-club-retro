// Roda um arquivo .sql (multi-statement) contra o Postgres do Supabase.
// Uso: node --env-file=.env.local scripts/sql.mjs <arquivo.sql>
//   ou: node --env-file=.env.local scripts/sql.mjs -q "select ..."
import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) {
  console.error("Sem POSTGRES_URL_NON_POOLING no ambiente (rode com --env-file=.env.local)");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1, prepare: false });

const [flag, arg] = process.argv.slice(2);
const query = flag === "-q" ? arg : readFileSync(flag, "utf8");

try {
  const res = await sql.unsafe(query);
  if (Array.isArray(res) && res.length && flag === "-q") console.table(res.slice(0, 50));
  console.log("OK" + (flag === "-q" ? "" : ` — ${flag}`));
} catch (e) {
  console.error("FALHOU:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
