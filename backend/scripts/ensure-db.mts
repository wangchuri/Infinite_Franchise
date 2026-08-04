import fs from "node:fs";
import { spawnSync } from "node:child_process";

const envText = fs.readFileSync(".env", "utf8");
const match = envText.match(/^DATABASE_URL=(.+)$/m);
if (!match) {
  console.error("DATABASE_URL missing in .env");
  process.exit(1);
}

const url = new URL(match[1].trim());
const password = decodeURIComponent(url.password);
const user = decodeURIComponent(url.username);
const host = url.hostname;
const port = url.port || "5432";
const db = url.pathname.replace(/^\//, "") || "postgres";
const psql = process.env.PSQL_BIN || "psql";
const env = { ...process.env, PGPASSWORD: password };

function run(args: string[]) {
  return spawnSync(psql, args, { env, encoding: "utf8" });
}

const exists = run([
  "-U",
  user,
  "-h",
  host,
  "-p",
  port,
  "-d",
  "postgres",
  "-tAc",
  `SELECT 1 FROM pg_database WHERE datname='${db}'`,
]);

if (exists.status !== 0) {
  console.error(exists.stderr || exists.stdout);
  process.exit(exists.status ?? 1);
}

if (String(exists.stdout).trim() === "1") {
  console.log("database_exists");
} else {
  const created = run([
    "-U",
    user,
    "-h",
    host,
    "-p",
    port,
    "-d",
    "postgres",
    "-c",
    `CREATE DATABASE "${db}"`,
  ]);
  if (created.status !== 0) {
    console.error(created.stderr || created.stdout);
    process.exit(created.status ?? 1);
  }
  console.log("database_created");
}

const ping = run([
  "-U",
  user,
  "-h",
  host,
  "-p",
  port,
  "-d",
  db,
  "-tAc",
  "SELECT current_database() || '|' || current_user",
]);

if (ping.status !== 0) {
  console.error(ping.stderr || ping.stdout);
  process.exit(ping.status ?? 1);
}

console.log(`connected:${String(ping.stdout).trim()}`);
