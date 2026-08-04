import "dotenv/config";
import { hashPassword } from "../src/auth.ts";
import { pool } from "../src/db.ts";
import { createUser, findUserByEmailOrUsername } from "../src/users.ts";

/**
 * Local mock users for development.
 * No email/SMS verification — password auth only.
 */
const MOCK_USERS = [
  {
    username: "demo",
    email: "demo@infinite.local",
    password: "demo12345",
    displayName: "演示用户",
  },
  {
    username: "night_pilot",
    email: "pilot@infinite.local",
    password: "demo12345",
    displayName: "夜航员",
  },
];

async function main() {
  for (const u of MOCK_USERS) {
    const existing = await findUserByEmailOrUsername(u.email);
    if (existing) {
      console.log(`skip existing ${u.username}`);
      continue;
    }
    const passwordHash = await hashPassword(u.password);
    const row = await createUser({
      username: u.username,
      email: u.email,
      passwordHash,
      displayName: u.displayName,
    });
    console.log(`created ${row.username} <${row.email}>`);
  }
  await pool.end();
  console.log("seed done");
  console.log(
    'try: POST /api/auth/login { "login": "demo", "password": "demo12345" }',
  );
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
