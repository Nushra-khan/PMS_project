// Imported first by DB tests so lib/env.ts sees the test database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

export {};
