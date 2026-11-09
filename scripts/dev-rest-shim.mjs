#!/usr/bin/env node
/**
 * DEVELOPMENT/TEST ONLY — never deploy.
 *
 * A minimal stand-in for Supabase's REST gateway that serves ONLY the public
 * marketplace RPC functions (`POST /rest/v1/rpc/<fn>`) from a local
 * PostgreSQL database built by scripts/db-test.sh. Each call runs as the
 * `anon` role inside a read-only transaction, so Row Level Security applies
 * exactly as it would on Supabase.
 *
 * It exists so the public pages can be rendered and E2E-tested without a
 * Supabase project (e.g. in CI or offline). Auth is not emulated.
 *
 *   TEST_DB=aio_test PGHOST=/tmp PGPORT=54329 PGUSER=postgres node scripts/dev-rest-shim.mjs
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dev pnpm dev
 */
import { createServer } from "node:http";

import pg from "pg";

const ALLOWED = new Set([
  "public_cities",
  "public_categories",
  "search_businesses",
  "get_business_profile",
  "public_business_paths",
]);
const PORT = Number(process.env.SHIM_PORT ?? 54321);
const pool = new pg.Pool({
  database: process.env.TEST_DB ?? "aio_test",
  max: 5,
});

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const match = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(
    new URL(req.url, "http://x").pathname,
  );
  if (req.method !== "POST" || !match || !ALLOWED.has(match[1])) {
    send(res, 404, { message: "not available in dev shim" });
    return;
  }

  let raw = "";
  for await (const chunk of req) raw += chunk;
  let args;
  try {
    args = raw ? JSON.parse(raw) : {};
  } catch {
    send(res, 400, { message: "invalid json" });
    return;
  }

  const names = Object.keys(args);
  if (!names.every((name) => /^p_[a-z_]+$/.test(name))) {
    send(res, 400, { message: "invalid argument name" });
    return;
  }
  const placeholders = names
    .map((name, index) => `${name} => $${index + 1}`)
    .join(", ");
  const call = `select public.${match[1]}(${placeholders}) as result`;

  const client = await pool.connect();
  try {
    await client.query("begin read only");
    await client.query("set local role anon");
    const { rows } = await client.query(
      call,
      names.map((name) => args[name]),
    );
    await client.query("commit");
    send(res, 200, rows[0]?.result ?? null);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    send(res, 400, { message: error.message, code: error.code });
  } finally {
    client.release();
  }
}).listen(PORT, "127.0.0.1", () =>
  console.log(`dev REST shim on http://127.0.0.1:${PORT}`),
);
