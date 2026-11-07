"use strict";

const http = require("node:http");
const fs = require("node:fs");
const MAX_BODY = 64 * 1024,
  MAX_EVENTS = 200,
  MAX_ACTIVE = 12,
  TIMEOUT = 18_000;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const READ_RPC = /^(?:get_|search_|resolve_|count_|is_|check_)[A-Za-z0-9_]*$/;

function validateConfig(value) {
  if (
    !value ||
    typeof value.url !== "string" ||
    typeof value.key !== "string" ||
    !value.key
  )
    throw Error("config requires url and key");
  const url = new URL(value.url);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error("url must be an https *.supabase.co origin");
  return { origin: url.origin, key: value.key };
}
const readRpc = (name) =>
  name === "rm_get_page_complete_v2" || READ_RPC.test(name);
function pgArray(values) {
  return `{${values.map((v) => (v == null ? "NULL" : `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)).join(",")}}`;
}
function encode(value) {
  return Array.isArray(value)
    ? pgArray(value)
    : value && typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
function badPath(raw) {
  return (
    typeof raw !== "string" ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    /(?:^|\/)(?:\.{1,2}|%2e(?:%2e)?)(?:\/|$)/i.test(raw)
  );
}
function planRequest(config, method, raw, body = "") {
  if (badPath(raw)) throw Error("invalid request URL");
  const request = new URL(raw, "http://gateway.invalid");
  if (
    request.origin !== "http://gateway.invalid" ||
    raw
      .split("?")[0]
      .split("/")
      .some((segment) => [".", ".."].includes(decodeURIComponent(segment)))
  )
    throw Error("invalid request URL");
  const found = request.pathname.match(
    /^\/rest\/v1\/(?:rpc\/)?([A-Za-z_][A-Za-z0-9_]*)$/,
  );
  if (!found) throw Error("non-REST resource");
  const rpc = request.pathname.startsWith("/rest/v1/rpc/"),
    name = found[1];
  let upstreamMethod = method;
  if (method === "POST" && rpc) {
    if (!readRpc(name)) throw Error("RPC outside read-name allowlist");
    let args;
    try {
      args = JSON.parse(body || "{}");
    } catch {
      throw Error("invalid RPC JSON body");
    }
    if (!args || Array.isArray(args) || typeof args !== "object")
      throw Error("invalid RPC arguments");
    for (const [key, value] of Object.entries(args)) {
      if (!IDENT.test(key) || value === undefined)
        throw Error("invalid RPC argument");
      request.searchParams.set(key, encode(value));
    }
    upstreamMethod = "GET";
  }
  if (!["GET", "HEAD"].includes(upstreamMethod))
    throw Error("write method blocked");
  if (rpc && !readRpc(name)) throw Error("RPC outside read-name allowlist");
  return {
    method: upstreamMethod,
    path: request.pathname,
    url: config.origin + request.pathname + request.search,
  };
}
function createGateway({ config, fetchImpl = globalThis.fetch } = {}) {
  const upstream = validateConfig(config);
  if (typeof fetchImpl !== "function")
    throw Error("fetch implementation required");
  const audit = {
    reads: 0,
    blocked: 0,
    errors: 0,
    active: 0,
    upstreamMethods: {},
    events: [],
  };
  const event = (e) => {
    audit.events.push(e);
    if (audit.events.length > MAX_EVENTS)
      audit.events.splice(0, audit.events.length - MAX_EVENTS);
  };
  const json = (res, status, value) => {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  const reject = (res, req, status, code, message) => {
    audit.blocked++;
    event({
      method: req.method,
      path: String(req.url || "").split("?")[0],
      status,
      code,
      blocked: true,
    });
    json(res, status, { code, message });
  };
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/__audit")
      return json(res, 200, audit);
    let body = "",
      plan;
    try {
      if (req.method !== "HEAD") {
        let bytes = 0;
        const chunks = [];
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > MAX_BODY) throw Error("request body too large");
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks).toString("utf8");
      }
      plan = planRequest(upstream, req.method, req.url, body);
    } catch (err) {
      return reject(res, req, 405, "PREPROD_READONLY_BLOCKED", err.message);
    }
    if (audit.active >= MAX_ACTIVE)
      return reject(
        res,
        req,
        503,
        "PREPROD_READ_CONCURRENCY_EXHAUSTED",
        "read concurrency exhausted",
      );
    const headers = {
      apikey: upstream.key,
      Authorization: `Bearer ${upstream.key}`,
      "Accept-Profile": "public",
    };
    if (req.headers.accept) headers.accept = req.headers.accept;
    if (req.headers.range) headers.range = req.headers.range;
    if (req.headers["range-unit"])
      headers["range-unit"] = req.headers["range-unit"];
    const count = String(req.headers.prefer || "").match(
      /(?:^|,)\s*count=(exact|planned|estimated)\s*(?:,|$)/,
    );
    if (count) headers.Prefer = `count=${count[1]}`;
    audit.active++;
    audit.reads++;
    audit.upstreamMethods[plan.method] =
      (audit.upstreamMethods[plan.method] || 0) + 1;
    try {
      const response = await fetchImpl(plan.url, {
        method: plan.method,
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (
        response.redirected ||
        (response.status >= 300 && response.status < 400)
      ) {
        audit.errors++;
        event({
          method: req.method,
          upstreamMethod: plan.method,
          path: plan.path,
          status: 502,
          code: "PREPROD_UPSTREAM_REDIRECT_REFUSED",
        });
        return json(res, 502, { code: "PREPROD_UPSTREAM_REDIRECT_REFUSED" });
      }
      const bodyOut =
          plan.method === "HEAD"
            ? Buffer.alloc(0)
            : Buffer.from(await response.arrayBuffer()),
        outHeaders = {};
      for (const h of [
        "content-type",
        "content-range",
        "range-unit",
        "preference-applied",
      ])
        if (response.headers.has(h)) outHeaders[h] = response.headers.get(h);
      if (!response.ok) audit.errors++;
      event({
        method: req.method,
        upstreamMethod: plan.method,
        path: plan.path,
        status: response.status,
        error: response.ok ? undefined : "UPSTREAM_STATUS",
      });
      res.writeHead(response.status, outHeaders);
      return res.end(bodyOut);
    } catch (err) {
      audit.errors++;
      event({
        method: req.method,
        upstreamMethod: plan.method,
        path: plan.path,
        status: 502,
        code: "PREPROD_UPSTREAM_UNAVAILABLE",
      });
      return json(res, 502, {
        code: "PREPROD_UPSTREAM_UNAVAILABLE",
        message: err.name || "Error",
      });
    } finally {
      audit.active--;
    }
  });
  server.audit = audit;
  return server;
}
function readConfig() {
  return JSON.parse(
    fs.readFileSync(
      process.env.PREPROD_READONLY_CONFIG ||
        "/run/preprod-readonly/upstream.json",
      "utf8",
    ),
  );
}
if (require.main === module)
  createGateway({ config: readConfig() }).listen(3000, "0.0.0.0", () =>
    console.log("PREPROD readonly gateway listening on :3000"),
  );
module.exports = { createGateway, planRequest, validateConfig, pgArray };
