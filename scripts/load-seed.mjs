import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import pg from "pg";

const { Client } = pg;

function parseDotEnv(source) {
  const values = {};

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

async function main() {
  const projectRoot = process.cwd();
  const envText = await readFile(resolve(projectRoot, ".env"), "utf8");
  const env = parseDotEnv(envText);
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing from .env");
  }

  const seedSql = await readFile(resolve(projectRoot, "supabase", "seed.sql"), "utf8");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();

  try {
    const schemaCheck = await client.query(
      "select to_regclass('public.profiles') as profiles_table"
    );

    if (!schemaCheck.rows[0]?.profiles_table) {
      throw new Error(
        "PMS schema is missing. Run the initial migration before loading seed data."
      );
    }

    await client.query(seedSql);
    console.log("Pseudo-production seed data applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
