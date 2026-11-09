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
 * It exists so pages can be rendered and E2E-tested without a Supabase
 * project (e.g. in CI or offline). A tiny auth emulation (password grant,
 * /user, logout) signs HS256 tokens with a throwaway local secret; every
 * user in auth.users can sign in with SHIM_PASSWORD. Authenticated requests
 * run as the `authenticated` role with request.jwt.claims set, so RLS is
 * enforced by PostgreSQL exactly as on Supabase. Table access supports only
 * the small subset of PostgREST the app uses (eq/is filters, plain columns).
 *
 *   TEST_DB=aio_test PGHOST=/tmp PGPORT=54329 PGUSER=postgres node scripts/dev-rest-shim.mjs
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dev pnpm dev
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

import pg from "pg";

const PUBLIC_RPC = new Set([
  "public_cities",
  "public_categories",
  "search_businesses",
  "get_business_profile",
  "public_business_paths",
  "track_business_event",
]);
const USER_RPC = new Set([
  ...PUBLIC_RPC,
  "my_businesses",
  "dashboard_business",
  "create_business",
  "update_business_location",
  "set_location_hours",
  "submit_business_for_review",
]);
const WRITE_RPC = new Set([
  "track_business_event",
  "create_business",
  "update_business_location",
  "set_location_hours",
  "submit_business_for_review",
]);
const TABLES = new Set([
  "profiles",
  "user_roles",
  "businesses",
  "business_services",
]);

const PORT = Number(process.env.SHIM_PORT ?? 54321);
const PASSWORD = process.env.SHIM_PASSWORD ?? "dev-password-1";
const SECRET = randomBytes(32);
const IDENT = /^[a-z_]+$/;

const pool = new pg.Pool({
  database: process.env.TEST_DB ?? "aio_test",
  max: 5,
});

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

// --- tokens ------------------------------------------------------------------

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function sign(claims) {
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}`;
  const signature = createHmac("sha256", SECRET)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

function verify(token) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = createHmac("sha256", SECRET)
    .update(`${header}.${payload}`)
    .digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  return claims.exp * 1000 > Date.now() ? claims : null;
}

function claimsFrom(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
  return match ? verify(match[1]) : null;
}

function userJson(row) {
  return {
    id: row.id,
    aud: "authenticated",
    role: "authenticated",
    email: row.email,
    email_confirmed_at: row.created_at,
    app_metadata: row.raw_app_meta_data,
    user_metadata: row.raw_user_meta_data,
    created_at: row.created_at,
  };
}

async function session(user) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600;
  return {
    access_token: sign({
      sub: user.id,
      email: user.email,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + expiresIn,
      session_id: randomBytes(8).toString("hex"),
    }),
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: now + expiresIn,
    refresh_token: `${user.id}.${randomBytes(16).toString("hex")}`,
    user: userJson(user),
  };
}

async function findUser(where, value) {
  const { rows } = await pool.query(
    `select id, email, raw_user_meta_data, raw_app_meta_data, created_at from auth.users where ${where} = $1`,
    [value],
  );
  return rows[0] ?? null;
}

async function handleAuth(req, res, url, body) {
  const path = url.pathname.replace("/auth/v1", "");
  if (req.method === "POST" && path === "/token") {
    const grant = url.searchParams.get("grant_type");
    let user = null;
    if (grant === "password" && body.password === PASSWORD) {
      user = await findUser("email", String(body.email ?? "").toLowerCase());
    } else if (grant === "refresh_token") {
      const id = String(body.refresh_token ?? "").split(".")[0];
      if (/^[0-9a-f-]{36}$/.test(id)) user = await findUser("id", id);
    }
    if (!user) {
      send(res, 400, {
        code: 400,
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      });
      return;
    }
    send(res, 200, await session(user));
    return;
  }
  if (req.method === "GET" && path === "/user") {
    const claims = claimsFrom(req);
    const user = claims && (await findUser("id", claims.sub));
    if (!user) {
      send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      return;
    }
    send(res, 200, userJson(user));
    return;
  }
  if (req.method === "POST" && path === "/logout") {
    send(res, 204);
    return;
  }
  send(res, 404, { msg: "not available in dev shim" });
}

// --- database ------------------------------------------------------------------

async function run(claims, readOnly, sql, params) {
  const client = await pool.connect();
  try {
    await client.query(readOnly ? "begin read only" : "begin");
    if (claims) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(claims),
      ]);
      await client.query("set local role authenticated");
    } else {
      await client.query(
        "select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)",
      );
      await client.query("set local role anon");
    }
    const result = await client.query(sql, params);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function pgError(res, error) {
  const status = error.code === "42501" ? 403 : 400;
  send(res, status, {
    message: error.message,
    code: error.code,
    hint: error.hint ?? null,
    details: error.detail ?? null,
  });
}

async function handleRpc(req, res, fn, args) {
  const claims = claimsFrom(req);
  const allowed = claims ? USER_RPC : PUBLIC_RPC;
  if (req.method !== "POST" || !allowed.has(fn)) {
    send(res, 404, { message: "not available in dev shim" });
    return;
  }
  const names = Object.keys(args);
  if (!names.every((name) => /^p_[a-z_0-9]+$/.test(name))) {
    send(res, 400, { message: "invalid argument name" });
    return;
  }
  const placeholders = names
    .map((name, index) => `${name} => $${index + 1}`)
    .join(", ");
  const readOnly = !WRITE_RPC.has(fn);
  try {
    const { rows } = await run(
      claims,
      readOnly,
      `select public.${fn}(${placeholders}) as result`,
      names.map((name) => {
        const value = args[name];
        return value !== null && typeof value === "object"
          ? JSON.stringify(value)
          : value;
      }),
    );
    send(res, 200, rows[0]?.result ?? null);
  } catch (error) {
    pgError(res, error);
  }
}

function parseQuery(url) {
  const filters = [];
  let select = "*";
  for (const [key, value] of url.searchParams) {
    if (key === "select") {
      select = value;
      continue;
    }
    if (!IDENT.test(key)) throw new Error(`unsupported filter ${key}`);
    const match = /^(eq|is)\.(.*)$/.exec(value);
    if (!match) throw new Error(`unsupported operator in ${key}=${value}`);
    filters.push({ column: key, op: match[1], value: match[2] });
  }
  const columns =
    select === "*" ? ["*"] : select.split(",").map((column) => column.trim());
  if (!columns.every((column) => column === "*" || IDENT.test(column))) {
    throw new Error(`unsupported select ${select}`);
  }
  return { filters, columns };
}

function whereClause(filters, params) {
  if (filters.length === 0) return "";
  return (
    " where " +
    filters
      .map(({ column, op, value }) => {
        if (op === "is") {
          if (!["null", "true", "false"].includes(value))
            throw new Error("unsupported is value");
          return `"${column}" is ${value}`;
        }
        params.push(value);
        return `"${column}"::text = $${params.length}`;
      })
      .join(" and ")
  );
}

async function handleTable(req, res, url, table, body) {
  const claims = claimsFrom(req);
  if (!TABLES.has(table) || !claims) {
    send(res, 404, { message: "not available in dev shim" });
    return;
  }
  try {
    const { filters, columns } = parseQuery(url);
    const list = columns
      .map((column) => (column === "*" ? "*" : `"${column}"`))
      .join(", ");
    const params = [];
    let sql;
    if (req.method === "GET") {
      sql = `select ${list} from public.${table}${whereClause(filters, params)}`;
    } else if (req.method === "PATCH" || req.method === "POST") {
      const row = Array.isArray(body) ? body[0] : body;
      const keys = Object.keys(row ?? {});
      if (!keys.every((key) => IDENT.test(key)) || keys.length === 0)
        throw new Error("invalid body");
      const values = keys.map((key) => {
        params.push(row[key]);
        return `$${params.length}`;
      });
      sql =
        req.method === "PATCH"
          ? `update public.${table} set ${keys.map((key, i) => `"${key}" = ${values[i]}`).join(", ")}${whereClause(filters, params)}`
          : `insert into public.${table} (${keys.map((key) => `"${key}"`).join(", ")}) values (${values.join(", ")})`;
      sql += ` returning ${list}`;
    } else {
      send(res, 405, { message: "method not supported" });
      return;
    }
    const { rows } = await run(claims, req.method === "GET", sql, params);
    const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    send(
      res,
      req.method === "POST" ? 201 : 200,
      wantsObject ? (rows[0] ?? null) : rows,
    );
  } catch (error) {
    if (error.code) pgError(res, error);
    else send(res, 400, { message: error.message });
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    send(res, 400, { message: "invalid json" });
    return;
  }

  try {
    if (url.pathname.startsWith("/auth/v1/"))
      return await handleAuth(req, res, url, body);
    const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
    if (rpc) return await handleRpc(req, res, rpc[1], body);
    const table = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
    if (table) return await handleTable(req, res, url, table[1], body);
    send(res, 404, { message: "not available in dev shim" });
  } catch (error) {
    console.error(error);
    send(res, 500, { message: "shim error" });
  }
}).listen(PORT, "127.0.0.1", () =>
  console.log(`dev REST shim on http://127.0.0.1:${PORT}`),
);
