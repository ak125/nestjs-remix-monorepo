#!/usr/bin/env python3
"""Contrat HTTP empirique de GET /api/vehicles/brands/:brandId/models.

Joue le même corpus contre A2 (Node complet) et R2 (route Rust), en direct ou
derrière le Caddy du banc, et consigne pour chaque cas : statut, en-têtes dans
l'ordre reçu, corps brut et décodé, appels à la base (compteurs du rejeu) et
effets dans le Redis du banc (session, BotGuard). `diff` compare deux captures
après les seules normalisations listées dans NORMALISATIONS.

Tout reste dans le banc : Redis du banc (port 3141, vérifié avant toute
écriture), rejeu local (3122), secrets synthétiques de route.sh, utilisateurs
synthétiques (identifiants 9001…, adresses example.invalid).

  contract.py fixtures <sortie.jsonl>
      utilisateurs synthétiques rejoués (clés Node `select=*` et clés Rust)
  contract.py prepare
      vide le Redis du banc puis pose la configuration BotGuard du contrat ;
      à lancer AVANT de démarrer le processus capturé (config lue au démarrage)
  contract.py capture <direct|caddy> <base_url> <sortie> <ns> <chemins…>
      ns = entier 1..65535 qui sépare les IP clientes de deux captures
  contract.py outages <direct|caddy> <base_url> <sortie> <ns>
      pannes du rejeu puis du Redis (arrêt/redémarrage via route.sh)
  contract.py probes <direct|caddy> <base_url> <sortie> <ns>
      variantes de X-Synthetic-Probe (fenêtre, casse, méthode, chemin, doublon,
      échappement) ; statut attendu de chaque cas vérifié dans expect.json
  contract.py backend-outage <node|rust> <base_url> <sortie> <ns>
      arrêt puis reprise de l'amont de la sélection derrière Caddy (attentes explicites)
  contract.py budget <node|rust> <base_url> <sortie> <ns>
      budget du limiteur d'un même client entre la route et une exclusion servie par Node
  contract.py scope <base_url_r2> <sortie> <ns>
      R2 en direct : chemin valide sans année (laissé à Node) refusé par 421 sans effet
  contract.py diff <capture_a> <capture_b> [rapport.json]
  contract.py diff-outages <pannes_a> <pannes_b> <ns_a> <ns_b> [rapport.json]
  contract.py journey-routes <parcours.json> <node|rust> [rapport.json]
      destination de chaque appel /api d'un parcours navigateur (journey.mjs) :
      X-Request-Id de la réponse → ligne Caddy (amont) → ligne de fin A2 ou R2
  contract.py routes <capture> <node|rust> [rapport.json]
      destination de chaque cas d'une capture derrière Caddy (journal Caddy
      corrélé par X-Contract-Case, journaux A2 et R2)

Variables : ROUTE_OUT (répertoire du banc), ROUTE_DATA (pour `outages`).
"""
import base64
import datetime
import gzip
import hashlib
import hmac
import http.client
import json
import os
import pathlib
import posixpath
import re
import secrets as pysecrets
import ssl
import subprocess
import sys
import time
import urllib.parse
import zlib

BENCH = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(os.environ.get("ROUTE_OUT", ""))
REDIS_PORT = "3141"
REPLAY = ("127.0.0.1", 3122)
ROUTE = "/api/vehicles/brands/{}/models"
YEAR_PATH = "/api/vehicles/brands/164/models?year=2008&page=0&limit=100"
BIG_PATH = "/api/vehicles/brands/140/models?year=2008&page=0&limit=100"
SITE_ORIGIN = "https://www.automecanik.com"
UA_BROWSER = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")
UA_GOOGLEBOT = ("Mozilla/5.0 (compatible; Googlebot/2.1; "
                "+http://www.google.com/bot.html)")
# Adresse réelle d'un robot Google (rDNS crawl-66-249-66-1.googlebot.com) :
# la vérification FCrDNS fait deux résolutions DNS, rien d'autre.
GOOGLEBOT_IP = "66.249.66.1"
BLOCKED_IP = "203.0.113.250"
PROBE_EGRESS_IP = "192.0.2.5"
CONTRACT_BOT_CONFIG = {"blockedIps": [BLOCKED_IP], "suspicionThreshold": 70}
SESSION_MAX_AGE_MS = 2592000000
USER_CACHE_TTL_S = 5  # CookieSerializer.CACHE_TTL et session.rs USER_CACHE_TTL

# Utilisateurs synthétiques : (identifiant, table, niveau stocké).
ADMIN_9, ADMIN_5, ADMIN_VERSIONED, CUSTOMER, UNKNOWN = "9001", "9002", "9003", "9101", "9999"
NORMALISATIONS = [
    "Date : valeur ignorée",
    "X-Request-ID généré : uuid v4 → <uuid>",
    "Content-Security-Policy : nonce → <nonce>",
    "X-RateLimit-Reset-* et Retry-After-* : écart ≤ 1 s toléré",
    "Set-Cookie : identifiant, signature et Expires → <sid>, <expires>",
    "corps JSON : champ timestamp → <ts>",
    "ETag d'un corps JSON dont seul le champ timestamp diffère : validateur faible W/\"len-sha1\" "
    "recalculé sur le corps reçu de chaque côté ; masqué seulement s'il concorde des deux côtés",
    "noms d'en-têtes comparés sans la casse ; ordre comparé à part",
    "Connection / Keep-Alive : rangés en transport, comparés à part",
    "journal d'erreurs : err_created_at ISO 8601 ms → <iso>, err_correlation err_<ms>_<9 base 36> "
    "→ <corr> (toute autre forme reste brute) ; err_stack → première ligne (nom: message) brute, "
    "suite → <pile> ; err_context.timestamp ISO 8601 ms → <iso> (error.service.ts handle404, "
    "routes/$.tsx : new Date().toISOString())",
    "page HTML (text/html, rendue par Node) : nonce déclaré par le CSP de la même réponse → "
    "<nonce>, ISO 8601 ms → <iso>, panier invité cart_<sessionID 32 base64url> → cart_<sid> ; "
    "appliqué seulement si les empreintes brutes diffèrent",
    "journaux : req.id généré par pino-http req-<ms>-<base 36> → <pino-id>, uuid → <uuid> "
    "(un id venu de l'en-tête reste brut) ; err.stack → première ligne brute",
    "journaux : lignes sans `req` des tâches de fond (contexte BACKGROUND_LOG) écartées et comptées "
    "à part (`logs_background`)",
    "IP clientes 2001:db8:<ns>:: : le ns déclaré dans meta.json de chaque capture → <ns>",
    "Redis : TTL → présence (≈ valeur nominale) ; hachages stats par minute → sommes "
    "(le nombre de minutes dépend de l'horloge) ; familles hors REDIS_SCOPE inventoriées à part",
    "récents blocages BotGuard : champ timestamp → <ts>",
]


def die(message):
    print(f"contract: {message}", file=sys.stderr)
    sys.exit(1)


# --- Redis du banc -----------------------------------------------------------

def redis(*args, check=True):
    result = subprocess.run(["redis-cli", "-p", REDIS_PORT, "--no-raw", *args],
                            capture_output=True, text=True, timeout=10)
    if check and result.returncode != 0:
        die(f"redis {args[0]}: {result.stderr.strip()}")
    return result.stdout.strip()


def redis_raw(*args):
    result = subprocess.run(["redis-cli", "-p", REDIS_PORT, "--raw", *args],
                            capture_output=True, text=True, timeout=10)
    return result.stdout.rstrip("\n") if result.returncode == 0 else None


def assert_bench_redis():
    """Refuse d'écrire ailleurs que dans le Redis du banc (répertoire ROUTE_OUT/redis)."""
    if not OUT.is_dir():
        die("ROUTE_OUT absent")
    lines = (redis_raw("CONFIG", "GET", "dir") or "").splitlines()
    if len(lines) != 2 or pathlib.Path(lines[1]).resolve() != (OUT / "redis").resolve():
        die(f"le Redis du port {REDIS_PORT} n'est pas celui du banc : {lines}")


def bench_secrets():
    values = {}
    for line in (OUT / "secrets.env").read_text().splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            values[k] = v
    for name in ("SESSION_SECRET", "SEO_CP_SYNTHETIC_PROBE_SECRET"):
        if not values.get(name):
            die(f"{name} absent de secrets.env (route.sh start a2 le crée)")
    return values


# --- Sessions express-session signées comme cookie-signature -----------------

def sign_cookie(sid, secret):
    mac = base64.b64encode(hmac.new(secret.encode(), sid.encode(), hashlib.sha256).digest())
    signed = "s:" + sid + "." + mac.decode().rstrip("=")
    return "connect.sid=" + urlencode_component(signed)


def urlencode_component(value):
    safe = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")
    return "".join(c if c in safe else "".join(f"%{b:02X}" for b in c.encode()) for c in value)


def session_json(user=None, with_cookie=True):
    sess = {}
    if with_cookie:
        expires = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() + 20 * 86400))
        sess["cookie"] = {"originalMaxAge": SESSION_MAX_AGE_MS, "expires": expires, "secure": True,
                          "httpOnly": True, "path": "/", "sameSite": "lax"}
    if user is not None:
        sess["passport"] = {"user": user}
    return json.dumps(sess, separators=(",", ":"))


def new_sid(tag):
    return f"ct{tag}" + base64.urlsafe_b64encode(pysecrets.token_bytes(18)).decode().rstrip("=")


# --- Utilisateurs synthétiques rejoués ---------------------------------------

OBJECT_ACCEPT = "application/vnd.pgrst.object+json"
NOT_FOUND = json.dumps({"code": "PGRST116", "details": "The result contains 0 rows", "hint": None,
                        "message": "JSON object requested, multiple (or no) rows returned"})


def fixture_lines():
    admins = {ADMIN_9: "9", ADMIN_5: "5", ADMIN_VERSIONED: "9"}
    rows = []

    def add(path, status, body, content_type="application/vnd.pgrst.object+json; charset=utf-8"):
        rows.append({"key": f"GET {path}", "request": {"accept": OBJECT_ACCEPT, "accept-profile": "public"},
                     "status": status, "content_type": content_type, "content_range": None, "body": body})

    for uid in (ADMIN_9, ADMIN_5, ADMIN_VERSIONED, CUSTOMER, UNKNOWN):
        admin = admins.get(uid)
        full = {"cnfa_id": uid, "cnfa_login": f"banc-{uid}", "cnfa_mail": f"banc-{uid}@example.invalid",
                "cnfa_level": admin, "cnfa_fname": "Banc", "cnfa_name": f"Admin {uid}", "cnfa_activ": "1"}
        minimal = {"cnfa_id": uid, "cnfa_level": admin}
        for select, row in (("*", full), ("cnfa_id%2Ccnfa_level", minimal)):
            path = f"/rest/v1/___config_admin?select={select}&cnfa_id=eq.{uid}"
            if admin:
                add(path, 200, json.dumps(row))
            else:
                add(path, 406, NOT_FOUND, "application/json; charset=utf-8")
        cust = uid == CUSTOMER
        full_c = {"cst_id": uid, "cst_mail": f"banc-{uid}@example.invalid", "cst_fname": "Banc",
                  "cst_name": "Client", "cst_activ": "1", "cst_level": "1", "cst_is_pro": "0"}
        for select, row in (("*", full_c), ("cst_id", {"cst_id": uid})):
            path = f"/rest/v1/___xtr_customer?select={select}&cst_id=eq.{uid}"
            if cust:
                add(path, 200, json.dumps(row))
            else:
                add(path, 406, NOT_FOUND, "application/json; charset=utf-8")
    return rows


# --- HTTP brut ----------------------------------------------------------------

def connect(base, timeout=60):
    scheme, rest = base.split("://", 1)
    host, port = rest.rstrip("/").rsplit(":", 1)
    if scheme == "https":
        # Seule autorité acceptée : la racine interne du Caddy du banc (tls internal).
        ctx = ssl.create_default_context(
            cafile=str(OUT / "caddy/data/caddy/pki/authorities/local/root.crt"))
        ctx.set_alpn_protocols(["http/1.1"])
        return http.client.HTTPSConnection(host, int(port), timeout=timeout, context=ctx)
    return http.client.HTTPConnection(host, int(port), timeout=timeout)


def decode_body(raw, encoding):
    encoding = (encoding or "identity").strip().lower()
    try:
        if encoding in ("identity", ""):
            return raw, None
        if encoding == "gzip":
            return gzip.decompress(raw), None
        if encoding == "deflate":
            try:
                return zlib.decompress(raw), None
            except zlib.error:
                return zlib.decompress(raw, -15), None
        if encoding == "zstd":
            return subprocess.run(["zstd", "-d", "-c", "-q"], input=raw, capture_output=True,
                                  check=True, timeout=30).stdout, None
        if encoding == "br":
            script = ("const z=require('zlib');const c=[];process.stdin.on('data',d=>c.push(d));"
                      "process.stdin.on('end',()=>process.stdout.write(z.brotliDecompressSync(Buffer.concat(c))))")
            return subprocess.run(["node", "-e", script], input=raw, capture_output=True,
                                  check=True, timeout=30).stdout, None
    except (OSError, zlib.error, subprocess.SubprocessError) as e:
        return None, f"décodage {encoding} impossible : {e}"
    return None, f"codage inconnu {encoding}"


def send(base, method, target, headers, body=None, timeout=60):
    conn = connect(base, timeout)
    started = time.perf_counter()
    error = None
    try:
        conn.putrequest(method, target, skip_host=True, skip_accept_encoding=True)
        for name, value in headers:
            conn.putheader(name, value)
        conn.endheaders(body)
    except (BrokenPipeError, ConnectionResetError) as e:
        error = f"envoi interrompu : {type(e).__name__}"
    try:
        resp = conn.getresponse()
        raw = resp.read()
    except (http.client.HTTPException, OSError) as e:
        conn.close()
        return {"error": (error + " ; " if error else "") + f"réponse : {type(e).__name__}: {e}"}
    elapsed = (time.perf_counter() - started) * 1000
    conn.close()
    hdrs = [[k, v] for k, v in resp.getheaders()]
    encoding = resp.getheader("content-encoding")
    decoded, decode_error = decode_body(raw, encoding)
    record = {"status": resp.status, "reason": resp.reason, "version": resp.version,
              "headers": hdrs, "raw_len": len(raw), "raw_sha256": hashlib.sha256(raw).hexdigest(),
              "ms": round(elapsed, 2)}
    if error:
        record["send_error"] = error
    if decode_error:
        record["decode_error"] = decode_error
    if decoded is not None:
        record["body_len"] = len(decoded)
        record["body_sha256"] = hashlib.sha256(decoded).hexdigest()
        try:
            text = decoded.decode("utf-8")
            record["body"] = text if len(text) <= 300_000 else None
            try:
                record["json"] = json.loads(text) if text else None
            except ValueError:
                pass
        except UnicodeDecodeError:
            pass
    return record


def replay_stats():
    conn = http.client.HTTPConnection(*REPLAY, timeout=10)
    try:
        conn.request("GET", "/__stats")
        return json.loads(conn.getresponse().read())
    except OSError:
        return None
    finally:
        conn.close()


def replay_post(path, payload=None):
    conn = http.client.HTTPConnection(*REPLAY, timeout=10)
    try:
        conn.request("POST", path, body=json.dumps(payload) if payload is not None else b"",
                     headers={"Content-Type": "application/json"})
        return conn.getresponse().status
    finally:
        conn.close()


def replay_writes():
    conn = http.client.HTTPConnection(*REPLAY, timeout=10)
    try:
        conn.request("GET", "/__writes")
        return json.loads(conn.getresponse().read())
    finally:
        conn.close()


DB_COUNTERS = ("hits", "misses", "other_misses", "faulted", "header_mismatches", "accepted_writes",
               "refused_writes")


def stats_delta(before, after):
    if not before or not after:
        return None
    delta = {k: after.get(k, 0) - before.get(k, 0) for k in DB_COUNTERS}
    delta["new_miss_keys"] = after.get("miss_keys", [])[len(before.get("miss_keys", [])):]
    return delta


# --- Corpus -------------------------------------------------------------------

class Corpus:
    """Cas du contrat ; chaque client a sa propre IP (2001:db8:<ns>::<n>)."""

    def __init__(self, mode, ns, secrets_env):
        self.mode, self.ns, self.secret = mode, ns, secrets_env["SESSION_SECRET"]
        self.probe_secret = secrets_env["SEO_CP_SYNTHETIC_PROBE_SECRET"]
        self.n = 0
        self.cases = []

    def ip(self):
        self.n += 1
        return f"2001:db8:{self.ns:x}::{self.n:x}"

    def headers(self, case_id, ip, extra=(), drop=(), scheme="https", forwarded=True):
        base = [("Host", "localhost:3161"), ("User-Agent", UA_BROWSER), ("Accept", "*/*"),
                ("Accept-Language", "fr-FR,fr;q=0.9"), ("Content-Type", "application/json"),
                ("Accept-Encoding", "identity")]
        if forwarded:
            base.append(("Cf-Connecting-Ip", ip))
            if self.mode == "direct":
                # Ce que le Caddy du banc ajoute devant l'amont (proxy_headers).
                base += [("X-Real-IP", ip), ("X-Forwarded-For", ip), ("X-Forwarded-Proto", scheme),
                         ("X-Forwarded-Host", "localhost:3161")]
        base.append(("X-Contract-Case", case_id))
        drop_l = {d.lower() for d in drop}
        replaced = {k.lower() for k, _ in extra if not k.startswith("+")}
        out = [(k, v) for k, v in base if k.lower() not in drop_l and k.lower() not in replaced]
        for k, v in extra:
            out.append((k.lstrip("+"), v))
        return out

    def add(self, case_id, group, target, method="GET", extra=(), drop=(), body=None, scope="route",
            setup=None, observe=None, ip=None, scheme="https", forwarded=True, repeat=1):
        ip = ip or self.ip()
        self.cases.append({"id": case_id, "group": group, "method": method, "target": target,
                           "headers": self.headers(case_id, ip, extra, drop, scheme, forwarded),
                           "body": body, "scope": scope, "setup": setup, "observe": observe,
                           "ip": ip, "repeat": repeat})

    def session(self, case_id, user=None, with_cookie=True, raw=None, version=None):
        sid = new_sid(f"{self.ns:x}{len(self.cases):03d}")
        value = raw if raw is not None else session_json(user, with_cookie)

        def setup():
            redis("SET", f"sess:{sid}", value, "EX", "2592000")
            if version is not None:
                redis("SET", f"session_version:{version[0]}", json.dumps(version[1]))
        return sid, setup, sign_cookie(sid, self.secret)

    def probe(self, method, path, offset=0):
        window = int(time.time() * 1000) // 60000 + offset
        return hmac.new(self.probe_secret.encode(), f"{method}|{path}|{window}".encode(),
                        hashlib.sha256).hexdigest()


def build_corpus(mode, ns, secrets_env, path_files):
    c = Corpus(mode, ns, secrets_env)
    # Panne sur un chemin sans année AVANT qu'il entre dans le cache LRU de Node :
    # une erreur ne doit pas être mise en cache, l'appel suivant réussit. Depuis la
    # campagne v4, ce chemin reste à Node dans les deux sélections (Caddyfile.route) :
    # ces cas vérifient l'aiguillage, plus R2 (périmètre direct : `contract.py scope`).
    c.add("f-noyear-503", "pannes", "/api/vehicles/brands/151/models",
          setup=lambda: replay_post("/__fault", {"status": 503, "body": "{}", "remaining": 1,
                                                 "path_prefix": "/rest/v1/auto_modele"}))
    c.add("f-noyear-after", "pannes", "/api/vehicles/brands/151/models",
          setup=lambda: replay_post("/__fault", {"status": 200, "body": "", "remaining": 0}))
    c.add("f-noyear-cached", "pannes", "/api/vehicles/brands/151/models",
          setup=lambda: replay_post("/__fault", {"status": 503, "body": "{}", "remaining": -1,
                                                 "path_prefix": "/rest/v1/auto_modele"}))
    c.add("f-noyear-cleared", "pannes", "/api/vehicles/brands/140/models?page=1&limit=10",
          setup=lambda: replay_post("/__fault", {"status": 200, "body": "", "remaining": 0}))
    seen = set()
    for f in path_files:
        for line in pathlib.Path(f).read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line in seen:
                continue
            seen.add(line)
            c.add(f"p{len(seen):03d}", "chemins", line)
    r = ROUTE.format(140)
    # Limites du parseur de requête et du serveur HTTP.
    c.add("q-params-999", "limites", r + "?" + "&" * 999 + "foo=1")
    c.add("q-params-1000", "limites", r + "?" + "&" * 1000 + "foo=1")
    c.add("q-url-12k", "limites", r + "?search=" + "a" * 12000)
    c.add("q-url-20k", "limites", r + "?search=" + "a" * 20000)
    c.add("q-headers-20k", "limites", YEAR_PATH, extra=[(f"X-Pad-{i}", "x" * 160) for i in range(120)])
    c.add("q-body-json-ok", "corps", YEAR_PATH, body=b'{"a":1}', extra=[("Content-Length", "7")])
    c.add("q-body-json-bad", "corps", YEAR_PATH, body=b"{bad", extra=[("Content-Length", "4")])
    c.add("q-body-form", "corps", YEAR_PATH, body=b"year=1",
          extra=[("Content-Type", "application/x-www-form-urlencoded"), ("Content-Length", "6")])
    big = b'{"a":"' + b"x" * (10 * 1024 * 1024 + 16) + b'"}'
    c.add("q-body-11mb", "corps", YEAR_PATH, body=big, extra=[("Content-Length", str(len(big)))])
    c.add("q-accept-html", "négociation", YEAR_PATH, extra=[("Accept", "text/html")])
    c.add("q-no-content-type", "négociation", YEAR_PATH, drop=["Content-Type"])
    # Négociation de compression et validation conditionnelle.
    for i, enc in enumerate(["gzip", "br", "deflate", "zstd", "gzip, deflate, br, zstd", "*",
                             "gzip;q=0", "br;q=1, gzip;q=0.5", "identity;q=0", "x-unknown"]):
        c.add(f"h-enc-{i}", "compression", BIG_PATH, extra=[("Accept-Encoding", enc)])
    c.add("h-enc-small", "compression", r + "?foo=1", extra=[("Accept-Encoding", "gzip")])
    c.add("h-head", "méthodes", BIG_PATH, method="HEAD")
    c.add("h-head-gzip", "méthodes", BIG_PATH, method="HEAD", extra=[("Accept-Encoding", "gzip")])
    c.add("h-get-etag", "conditionnel", BIG_PATH)
    c.add("h-inm-match", "conditionnel", BIG_PATH, extra=[("If-None-Match", "@etag:h-get-etag")])
    c.add("h-inm-gzip", "conditionnel", BIG_PATH,
          extra=[("If-None-Match", "@etag:h-get-etag"), ("Accept-Encoding", "gzip")])
    c.add("h-inm-star", "conditionnel", BIG_PATH, extra=[("If-None-Match", "*")])
    c.add("h-inm-other", "conditionnel", BIG_PATH, extra=[("If-None-Match", 'W/"0-x"')])
    c.add("h-ims", "conditionnel", BIG_PATH, extra=[("If-Modified-Since", "Wed, 21 Oct 2099 07:28:00 GMT")])
    c.add("h-inm-head", "conditionnel", BIG_PATH, method="HEAD",
          extra=[("If-None-Match", "@etag:h-get-etag")])
    # Méthodes : via Caddy, seules GET/HEAD vont vers l'amont choisi.
    for m in ("POST", "PUT", "DELETE", "PATCH", "OPTIONS"):
        c.add(f"m-{m.lower()}", "méthodes", YEAR_PATH, method=m, scope="node",
              body=b"" if m in ("POST", "PUT", "PATCH") else None,
              extra=[("Content-Length", "0")] if m in ("POST", "PUT", "PATCH") else ())
    c.add("m-preflight-ok", "cors", YEAR_PATH, method="OPTIONS", scope="node",
          extra=[("Origin", SITE_ORIGIN), ("Access-Control-Request-Method", "GET"),
                 ("Access-Control-Request-Headers", "content-type")])
    c.add("m-preflight-ko", "cors", YEAR_PATH, method="OPTIONS", scope="node",
          extra=[("Origin", "https://evil.example"), ("Access-Control-Request-Method", "GET")])
    c.add("c-origin-ok", "cors", YEAR_PATH, extra=[("Origin", SITE_ORIGIN)])
    c.add("c-origin-ko", "cors", YEAR_PATH, extra=[("Origin", "https://evil.example")])
    c.add("c-origin-null", "cors", YEAR_PATH, extra=[("Origin", "null")])
    c.add("c-origin-www-http", "cors", YEAR_PATH, extra=[("Origin", "http://www.automecanik.com")])
    # Identifiants de requête.
    c.add("r-rid", "request-id", YEAR_PATH, extra=[("X-Request-ID", "contract-rid-1")])
    c.add("r-rid-empty", "request-id", YEAR_PATH, extra=[("X-Request-ID", "")])
    c.add("r-rid-dup", "request-id", YEAR_PATH, extra=[("X-Request-ID", "a"), ("+X-Request-ID", "b")])
    c.add("r-corr", "request-id", YEAR_PATH, extra=[("X-Correlation-ID", "contract-corr-1")])
    c.add("r-both", "request-id", YEAR_PATH,
          extra=[("X-Request-ID", "contract-rid-2"), ("X-Correlation-ID", "contract-corr-2")])
    c.add("r-rid-long", "request-id", YEAR_PATH, extra=[("X-Request-ID", "r" * 300)])
    # Sessions et utilisateurs (synthétiques).
    sess_cases = [
        ("s-none", None),
        ("s-unsigned", "connect.sid=abc"),
        ("s-bad-sig", "connect.sid=s%3Aabc.badsignature"),
    ]
    for cid, cookie in sess_cases:
        c.add(cid, "session", YEAR_PATH, extra=[("Cookie", cookie)] if cookie else ())

    def with_session(cid, user=None, with_cookie=True, raw=None, version=None, target=YEAR_PATH,
                     extra=(), drop=(), scheme="https", repeat=1, ip=None, cold_user_cache=False):
        sid, setup, cookie = c.session(cid, user, with_cookie, raw, version)
        if cold_user_cache:
            # Cache utilisateur de 5 s par processus (CookieSerializer et session.rs) :
            # sans pause, son expiration tombe au milieu d'une rafale selon la vitesse
            # du serveur (run 2 : b-score-auth → t-burst-admin à 4,78 s côté Node,
            # 4,19 s côté Rust). La pause donne le même état initial aux deux côtés.
            warm = setup

            def setup():
                time.sleep(USER_CACHE_TTL_S + 1)
                warm()
        c.add(cid, "session", target, extra=[("Cookie", cookie), *extra], drop=drop, setup=setup,
              observe={"session": sid}, scheme=scheme, repeat=repeat, ip=ip)

    def user(uid, source="admin", version=0):
        return {"userId": uid, "authSource": source, "sessionVersion": version}

    sid_unknown = new_sid("unknown")
    c.add("s-sid-unknown", "session", YEAR_PATH, extra=[("Cookie", sign_cookie(sid_unknown, c.secret))],
          observe={"session": sid_unknown})
    with_session("s-anon")
    with_session("s-admin9", user(ADMIN_9))
    with_session("s-admin5", user(ADMIN_5))
    with_session("s-customer", user(CUSTOMER, "customer"))
    with_session("s-legacy-string", CUSTOMER)
    with_session("s-no-source", {"userId": ADMIN_9, "sessionVersion": 0})
    with_session("s-unknown-user", user(UNKNOWN))
    with_session("s-unknown-user-http", user(UNKNOWN), scheme="http")
    with_session("s-version-stale", user(ADMIN_VERSIONED, version=1), version=(ADMIN_VERSIONED, 2))
    with_session("s-version-ok", user(ADMIN_VERSIONED, version=2))
    with_session("s-no-cookie-field", user(ADMIN_9), with_cookie=False)
    with_session("s-bad-json", raw="not json")
    with_session("s-cookie-twice", user(ADMIN_9), extra=[("+Cookie", "connect.sid=s%3Aother.sig")])
    # BotGuard (seuil 70 et IP bloquée posés par `prepare`).
    c.add("b-ip-blocked", "botguard", YEAR_PATH, ip=BLOCKED_IP)
    c.add("b-geo-cn", "botguard", YEAR_PATH, extra=[("Cf-Ipcountry", "cn")])
    c.add("b-geo-us", "botguard", YEAR_PATH, extra=[("Cf-Ipcountry", "US")])
    c.add("b-geo-fr", "botguard", YEAR_PATH, extra=[("Cf-Ipcountry", "FR")])
    c.add("b-score-75", "botguard", YEAR_PATH, drop=["Accept-Language"],
          extra=[("User-Agent", "curl/8.5.0"), ("Cf-Ipcountry", "US")])
    c.add("b-score-65", "botguard", YEAR_PATH, drop=["Accept-Language"], extra=[("User-Agent", "curl/8.5.0")])
    c.add("b-score-empty-ua", "botguard", YEAR_PATH, drop=["Accept-Language"],
          extra=[("User-Agent", ""), ("Cf-Ipcountry", "DE")])
    c.add("b-no-ua", "botguard", YEAR_PATH, drop=["Accept-Language", "User-Agent"], extra=[("Cf-Ipcountry", "DE")])
    with_session("b-score-auth", user(ADMIN_9), drop=["Accept-Language"],
                 extra=[("User-Agent", "curl/8.5.0"), ("Cf-Ipcountry", "US")])
    c.add("b-googlebot-fake", "botguard", YEAR_PATH, drop=["Accept-Language"],
          extra=[("User-Agent", UA_GOOGLEBOT), ("Cf-Ipcountry", "US")])
    c.add("b-googlebot-real", "botguard", YEAR_PATH, ip=GOOGLEBOT_IP, drop=["Accept-Language"],
          extra=[("User-Agent", UA_GOOGLEBOT), ("Cf-Ipcountry", "US")], repeat=17)
    c.add("b-probe-ok-cn", "botguard", YEAR_PATH,
          extra=[("Cf-Ipcountry", "CN"), ("X-Synthetic-Probe", "@probe")])
    c.add("b-probe-bad-cn", "botguard", YEAR_PATH,
          extra=[("Cf-Ipcountry", "CN"), ("X-Synthetic-Probe", "0" * 64)])
    c.add("b-egress-cn", "botguard", YEAR_PATH, ip=PROBE_EGRESS_IP, extra=[("Cf-Ipcountry", "CN")])
    c.add("b-internal-ip", "botguard", YEAR_PATH, ip="10.1.2.3", extra=[("Cf-Ipcountry", "CN")])
    c.add("b-blocked-ip-xff-only", "botguard", YEAR_PATH, ip=BLOCKED_IP, drop=["Cf-Connecting-Ip"])
    # Limitation de débit : 16 appels en rafale d'un même client.
    c.add("t-burst", "throttler", YEAR_PATH, repeat=17)
    with_session("t-burst-admin", user(ADMIN_9), repeat=17, cold_user_cache=True)
    with_session("t-burst-admin5", user(ADMIN_5), repeat=17, cold_user_cache=True)
    # Client local sans en-tête de transfert ; derrière Caddy, celui-ci pose l'IP de
    # boucle locale (client_ip), comme pour tout client sans Cf-Connecting-Ip.
    c.add("t-loopback", "throttler", YEAR_PATH, forwarded=False, repeat=17)
    # Pannes de la base rejouée (compteur `remaining` du rejeu).
    c.add("f-modele-503", "pannes", "/api/vehicles/brands/108/models?year=1995&page=0&limit=100",
          setup=lambda: replay_post("/__fault", {"status": 503, "body": '{"message":"unavailable"}',
                                                 "remaining": -1, "path_prefix": "/rest/v1/auto_modele"}))
    c.add("f-type-500", "pannes", "/api/vehicles/brands/108/models?year=2008&page=0&limit=100",
          setup=lambda: replay_post("/__fault", {"status": 500, "body": '{"code":"XX000","message":"boom"}',
                                                 "remaining": -1, "path_prefix": "/rest/v1/auto_type"}))
    with_session("f-admin-db", user(ADMIN_5),
                 extra=[], target="/api/vehicles/brands/108/models?year=2018&page=0&limit=100")
    c.cases[-1]["setup2"] = lambda: replay_post(
        "/__fault", {"status": 503, "body": "{}", "remaining": -1, "path_prefix": "/rest/v1/___config_admin"})
    c.add("f-clear", "pannes", "/api/vehicles/brands/108/models?year=2018&page=0&limit=100",
          setup=lambda: replay_post("/__fault", {"status": 200, "body": "", "remaining": 0}))
    return c


def build_probe_corpus(mode, ns, secrets_env, _path_files=()):
    """Variantes de X-Synthetic-Probe. Pays CN (bloqué) : une sonde vérifiée passe (200),
    une sonde refusée tombe sur le blocage géographique (403) ; FR et DE ne sont pas
    bloqués. Attendus déduits de SyntheticProbeCredentialService.verify (comparaison des
    chaînes hexadécimales, req.path brut sans la requête, fenêtres w et w-1) et de
    BotGuardMiddleware (étape 6b avant le blocage géographique)."""
    c = Corpus(mode, ns, secrets_env)
    year_q = YEAR_PATH.split("?", 1)[1]
    raw_esc = "/api/vehicles/brands/16%34/models"  # %34 = « 4 » : brandId décodé 164

    def probe(case_id, value, expect, target=YEAR_PATH, method="GET", country="CN", extra=(), repeat=1):
        hdrs = [("Cf-Ipcountry", country)] + ([("X-Synthetic-Probe", value)] if value is not None else [])
        c.add(case_id, "sonde", target, method=method, extra=hdrs + list(extra), repeat=repeat)
        c.cases[-1].update(expect=expect, fresh_window=True)

    def spec(**kw):
        return "@probe" + json.dumps(kw, separators=(",", ":"))

    probe("p-ok", "@probe", 200)
    probe("p-none-cn", None, 403)
    probe("p-ok-prev", spec(offset=-1), 200)
    probe("p-stale", spec(offset=-2), 403)
    probe("p-future", spec(offset=1), 403)
    probe("p-upper", spec(upper=True), 403)
    probe("p-cut", spec(cut=63), 403)
    probe("p-empty", "", 403)
    probe("p-pad", spec(pad=True), 200)  # espaces de tête et de fin retirés par le serveur HTTP
    probe("p-signed-head", spec(method="HEAD"), 403)
    probe("p-head-ok", "@probe", 200, method="HEAD")
    probe("p-head-signed-get", spec(method="GET"), 403, method="HEAD")
    probe("p-path-query", spec(path=YEAR_PATH), 403)
    probe("p-path-other", spec(path=ROUTE.format(165)), 403)
    probe("p-dup", "@probe", 403, extra=[("+X-Synthetic-Probe", "@probe")])  # valeurs jointes « , »
    probe("p-noyear", "@probe", 200, target=ROUTE.format(140))  # chemin sans année enregistré
    probe("p-slash", "@probe", 200, target=ROUTE.format(164) + "/?" + year_q)
    probe("p-escaped-raw", spec(path=raw_esc), 200, target=f"{raw_esc}?{year_q}")
    probe("p-escaped-decoded", spec(path=ROUTE.format(164)), 403, target=f"{raw_esc}?{year_q}")
    probe("p-bad-fr", "0" * 64, 200, country="FR")
    # isSyntheticExemptPath exclut /api : une sonde vérifiée reste limitée (15 puis 429, cf. t-burst).
    probe("p-burst", "@probe", [200] * 15 + [429] * 2, country="DE", repeat=17)
    return c


def resolve_headers(case, results, corpus):
    out = []
    for k, v in case["headers"]:
        if v.startswith("@etag:"):
            ref = results.get(v[6:])
            v = next((hv for hk, hv in (ref or {}).get("response", {}).get("headers", [])
                      if hk.lower() == "etag"), "missing-etag")
        elif v.startswith("@probe"):
            # « @probe » ou « @probe{json} » : method, path, offset (minutes), upper, pad, cut.
            spec = json.loads(v[6:] or "{}")
            v = corpus.probe(spec.get("method", case["method"]),
                             spec.get("path", case["target"].split("?", 1)[0]), spec.get("offset", 0))
            v = v.upper() if spec.get("upper") else v
            v = v[:spec["cut"]] if "cut" in spec else v
            v = f"  {v}\t " if spec.get("pad") else v
        out.append((k, v))
    return out


def observe_session(sid):
    value = redis_raw("GET", f"sess:{sid}")
    ttl = redis_raw("TTL", f"sess:{sid}")
    try:
        parsed = json.loads(value) if value else None
    except ValueError:
        parsed = value
    return {"value": parsed, "ttl": int(ttl) if ttl and ttl.lstrip("-").isdigit() else ttl}


def redis_snapshot():
    keys = sorted(k for k in (redis_raw("KEYS", "*") or "").splitlines() if k)
    snap = {"keys": {}, "stats": {}, "recent_blocks": [], "vbot": {}}
    for k in keys:
        family = re.sub(r"(sess:|session_version:|bot-guard:vbot:|bot-guard:stats:v2:minute:).*", r"\1*", k)
        snap["keys"][family] = snap["keys"].get(family, 0) + 1
        if k.startswith("bot-guard:stats:v2:minute:"):
            flat = (redis_raw("HGETALL", k) or "").splitlines()
            for f, v in zip(flat[::2], flat[1::2]):
                snap["stats"][f] = snap["stats"].get(f, 0) + int(v)
        elif k.startswith("bot-guard:vbot:"):
            snap["vbot"][k] = {"value": redis_raw("GET", k), "ttl": redis_raw("TTL", k)}
    for item in (redis_raw("LRANGE", "bot-guard:recent-blocks:v2", "0", "-1") or "").splitlines():
        try:
            snap["recent_blocks"].append(json.loads(item))
        except ValueError:
            snap["recent_blocks"].append(item)
    snap["recent_blocks_ttl"] = redis_raw("TTL", "bot-guard:recent-blocks:v2")
    return snap


# Familles Redis que la route lit ou écrit (BotGuard, session). Les autres
# (`bull:*`, `homepage:*`…) viennent des tâches de fond de Node A2, présentes
# aussi quand Node ne reçoit aucune requête : inventoriées, hors verdict.
REDIS_SCOPE = ("bot-guard:", "sess:", "session_version:")
MINUTE_STATS = "bot-guard:stats:v2:minute:"
LOG_NAMES = ("a2", "r2")


def redis_state():
    """Familles de la route sans les TTL : base des effets Redis par cas."""
    keys = sorted(k for k in (redis_raw("KEYS", "*") or "").splitlines() if k.startswith(REDIS_SCOPE))
    state = {"families": {}, "stats": {}, "values": {}, "recent_blocks": []}
    for k in keys:
        family = re.sub(r"^(sess:|bot-guard:stats:v2:minute:).*", r"\1*", k)
        state["families"][family] = state["families"].get(family, 0) + 1
        if k.startswith(MINUTE_STATS):
            flat = (redis_raw("HGETALL", k) or "").splitlines()
            for f, v in zip(flat[::2], flat[1::2]):
                state["stats"][f] = state["stats"].get(f, 0) + int(v)
        elif k.startswith(("bot-guard:vbot:", "session_version:")):
            state["values"][k] = redis_raw("GET", k)
    state["recent_blocks"] = (redis_raw("LRANGE", "bot-guard:recent-blocks:v2", "0", "-1") or "").splitlines()
    return state


def settled_state():
    """Relit jusqu'à deux lectures identiques à 100 ms d'écart (BotGuard écrit ses
    compteurs après la réponse, côté Node comme côté Rust) ; 3 s au plus."""
    state = redis_state()
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        time.sleep(0.1)
        again = redis_state()
        if again == state:
            return state
        state = again
    return dict(state, unsettled=True)


def redis_delta(before, after):
    d = {}
    stats = {k: after["stats"].get(k, 0) - before["stats"].get(k, 0)
             for k in sorted(set(before["stats"]) | set(after["stats"]))}
    if any(stats.values()):
        d["stats"] = {k: v for k, v in stats.items() if v}
    fam = {k: after["families"].get(k, 0) - before["families"].get(k, 0)
           for k in sorted(set(before["families"]) | set(after["families"])) if not k.startswith(MINUTE_STATS)}
    if any(fam.values()):
        d["families"] = {k: v for k, v in fam.items() if v}
    values = {k: [before["values"].get(k), after["values"].get(k)]
              for k in sorted(set(before["values"]) | set(after["values"]))
              if before["values"].get(k) != after["values"].get(k)}
    if values:
        d["values"] = values
    new = len(after["recent_blocks"]) - len(before["recent_blocks"])
    if new > 0 and after["recent_blocks"][new:] == before["recent_blocks"]:
        d["recent_blocks"] = after["recent_blocks"][:new]
    elif after["recent_blocks"] != before["recent_blocks"]:
        d["recent_blocks_rewritten"] = [before["recent_blocks"], after["recent_blocks"]]
    if after.get("unsettled"):
        d["unsettled"] = True
    return d


def log_files():
    files = {n: OUT / "logs" / f"{n}.log" for n in LOG_NAMES}
    files["caddy"] = OUT / "caddy-requests.log"
    return files


def log_offsets():
    return {n: (p.stat().st_size if p.exists() else 0) for n, p in log_files().items()}


def log_lines_since(offsets):
    """Lignes complètes ajoutées depuis `offsets` dans chaque journal du banc
    (a2, r2, caddy) et curseurs suivants : une ligne tardive revient au cas suivant."""
    lines, cursor = {}, dict(offsets)
    for n, p in log_files().items():
        if not p.exists():
            continue
        with open(p, "rb") as src:
            src.seek(offsets.get(n, 0))
            chunk = src.read()
        end = chunk.rfind(b"\n") + 1
        cursor[n] = offsets.get(n, 0) + end
        if end:
            lines[n] = chunk[:end].decode("utf-8", "replace").splitlines()
    return lines, cursor


def run_cases(mode, base, out_dir, corpus, log_name):
    out_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    results = {}
    cursor = log_start = log_offsets()
    with open(out_dir / "cases.jsonl", "w") as f:
        for case in corpus.cases:
            if case.get("setup"):
                case["setup"]()
            if case.get("setup2"):
                case["setup2"]()
            if case.get("fresh_window"):
                # Sonde signée à la minute de l'envoi : pas de changement de fenêtre en vol.
                while time.time() % 60 > 40:
                    time.sleep(0.5)
            minute = int(time.time() * 1000) // 60000
            before = replay_stats()
            redis_before = settled_state()
            responses = []
            for _ in range(case["repeat"]):
                headers = resolve_headers(case, results, corpus)
                responses.append(send(base, case["method"], case["target"], headers, case["body"]))
            same_minute = minute == int(time.time() * 1000) // 60000
            after = replay_stats()
            redis_after = settled_state()
            rec = {k: case[k] for k in ("id", "group", "method", "scope", "ip", "repeat")}
            rec["target"] = case["target"] if len(case["target"]) <= 400 else \
                case["target"][:200] + f"…({len(case['target'])} car.)"
            # En-têtes du dernier envoi, tels qu'envoyés (pas de nouvelle signature).
            rec["request_headers"] = [[k, v if len(v) <= 300 else v[:100] + "…"]
                                      for k, v in headers][:40]
            if case.get("expect") is not None:
                rec["expect"] = case["expect"]
            if case.get("fresh_window"):
                rec["same_minute"] = same_minute
            rec["response"] = responses[-1]
            if case["repeat"] > 1:
                rec["series"] = [{"status": r.get("status"),
                                  "rl": {k: v for k, v in r.get("headers", [])
                                         if k.lower().startswith(("x-ratelimit", "retry-after"))}}
                                 for r in responses]
            rec["db"] = stats_delta(before, after)
            rec["redis"] = redis_delta(redis_before, redis_after)
            rec["logs"], cursor = log_lines_since(cursor)
            if case.get("observe", {}) and case["observe"].get("session"):
                rec["session_after"] = observe_session(case["observe"]["session"])
            results[case["id"]] = rec
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush()
            print(f"{case['id']:<22} {rec['response'].get('status', rec['response'].get('error'))}")
    return log_start


def slice_logs(out_dir, log_name, log_start):
    """Tranche de chaque journal du banc ; app-log = celui du processus capturé."""
    for key, path in log_files().items():
        if path.exists():
            with open(path, "rb") as src:
                src.seek(log_start.get(key, 0))
                data = src.read()
            (out_dir / f"{key}-log.jsonl").write_bytes(data)
            if key == log_name:
                (out_dir / "app-log.jsonl").write_bytes(data)


def cmd_capture(mode, base, out, ns, path_files, builder=build_corpus):
    assert_bench_redis()
    out_dir = pathlib.Path(out)
    if out_dir.exists():
        die(f"{out_dir} existe déjà")
    corpus = builder(mode, int(ns), bench_secrets(), path_files)
    log_name = os.environ.get("CONTRACT_LOG", "a2")
    replay_post("/__reset")
    started = replay_stats()
    log_start = run_cases(mode, base, out_dir, corpus, log_name)
    time.sleep(7)  # vidage périodique (5 s) du journal d'erreurs
    meta = {"mode": mode, "base": base, "ns": int(ns), "cases": len(corpus.cases),
            "corpus": builder.__name__,
            "started_stats": started, "final_stats": replay_stats(), "bot_config": CONTRACT_BOT_CONFIG,
            "normalisations": NORMALISATIONS, "at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    (out_dir / "writes.json").write_text(json.dumps(replay_writes(), indent=1, ensure_ascii=False) + "\n")
    (out_dir / "redis.json").write_text(json.dumps(redis_snapshot(), indent=1, ensure_ascii=False) + "\n")
    slice_logs(out_dir, log_name, log_start)
    expected = [c for c in corpus.cases if c.get("expect") is not None]
    if expected:
        rows = [json.loads(l) for l in (out_dir / "cases.jsonl").read_text().splitlines()]
        check = []
        for r in rows:
            statuses = [s["status"] for s in r.get("series", [])] or [r["response"].get("status")]
            want = r["expect"] if isinstance(r["expect"], list) else [r["expect"]] * len(statuses)
            ok = statuses == want and r.get("same_minute", True)
            check.append({"id": r["id"], "expect": r["expect"], "statuses": statuses,
                          "same_minute": r.get("same_minute"), "ok": ok})
        (out_dir / "expect.json").write_text(json.dumps(check, indent=1, ensure_ascii=False) + "\n")
        print(f"contract: attendus {sum(x['ok'] for x in check)}/{len(check)}"
              + "".join(f"\n  ÉCART {x['id']} attendu {x['expect']} reçu {x['statuses']}"
                        for x in check if not x["ok"]))
    print(f"contract: {len(corpus.cases)} cas → {out_dir}")


def route_sh(*args):
    env = dict(os.environ)
    result = subprocess.run(["bash", str(BENCH / "route.sh"), *args], env=env, capture_output=True,
                            text=True, timeout=120)
    return result.returncode, (result.stdout + result.stderr).strip()


def cmd_outages(mode, base, out, ns):
    """Rejeu arrêté puis Redis arrêté ; chaque composant est redémarré ensuite."""
    assert_bench_redis()
    out_dir = pathlib.Path(out)
    if out_dir.exists():
        die(f"{out_dir} existe déjà")
    out_dir.mkdir(parents=True, mode=0o700)
    corpus = Corpus(mode, int(ns), bench_secrets())
    sid, setup, cookie = corpus.session("o", {"userId": ADMIN_5, "authSource": "admin", "sessionVersion": 0})
    setup()
    steps = []
    cursor = log_offsets()

    def probe(label, target, cookie_header=None, timeout=60, settle=0.3):
        nonlocal cursor
        ip = corpus.ip()
        extra = [("Cookie", cookie_header)] if cookie_header else ()
        r = send(base, "GET", target, corpus.headers(label, ip, extra), timeout=timeout)
        time.sleep(settle)
        logs, cursor = log_lines_since(cursor)
        steps.append({"id": label, "target": target, "ip": ip, "response": r, "logs": logs})
        print(f"{label:<22} {r.get('status', r.get('error'))}")

    def wait(label, seconds):
        """Laisse passer au moins un vidage du journal d'erreurs (période 5 s)."""
        nonlocal cursor
        time.sleep(seconds)
        logs, cursor = log_lines_since(cursor)
        steps.append({"id": label, "waited_s": seconds, "logs": logs})

    probe("o-before", "/api/vehicles/brands/173/models?year=1995&page=0&limit=100", cookie)
    code, msg = route_sh("stop", "replay")
    steps.append({"id": "stop replay", "rc": code, "out": msg})
    probe("o-replay-down", "/api/vehicles/brands/173/models?year=2008&page=0&limit=100")
    probe("o-replay-down-cached", "/api/vehicles/brands/151/models")
    probe("o-replay-down-session", "/api/vehicles/brands/173/models?year=2018&page=0&limit=100", cookie)
    # Client parti (2 s) pendant la lecture en échec (~7 s), après pino-http : ligne
    # de fin à la fermeture, puis erreurs de la requête poursuivie, dans cette étape.
    probe("o-replay-down-abort", "/api/vehicles/brands/173/models?year=2010&page=0&limit=100",
          timeout=2, settle=8)
    wait("o-replay-down-flush", 6)
    code, msg = route_sh("start", "replay", "0")
    steps.append({"id": "start replay", "rc": code, "out": msg})
    probe("o-replay-back", "/api/vehicles/brands/173/models?year=2008&page=0&limit=100")
    code, msg = route_sh("stop", "redis")
    steps.append({"id": "stop redis", "rc": code, "out": msg})
    probe("o-redis-down", "/api/vehicles/brands/128/models?year=1995&page=0&limit=100")
    probe("o-redis-down-session", "/api/vehicles/brands/128/models?year=2008&page=0&limit=100", cookie)
    code, msg = route_sh("start", "redis")
    steps.append({"id": "start redis", "rc": code, "out": msg})
    time.sleep(3)
    probe("o-redis-back", "/api/vehicles/brands/128/models?year=2018&page=0&limit=100")
    setup()
    probe("o-redis-back-session", "/api/vehicles/brands/441/models?year=1995&page=0&limit=100", cookie)
    wait("o-final-flush", 7)
    # Rejeu redémarré : ses écritures acceptées sont celles reçues après la panne.
    steps.append({"id": "writes after replay restart", "writes": replay_writes()})
    (out_dir / "outages.json").write_text(json.dumps(steps, indent=1, ensure_ascii=False) + "\n")
    print(f"contract: pannes → {out_dir}")


# --- Comparaison --------------------------------------------------------------

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
TRANSPORT = {"connection", "keep-alive", "transfer-encoding"}


def norm_header(name, value):
    n = name.lower()
    if n == "date":
        return "<date>"
    if n == "x-request-id" and UUID.match(value):
        return "<uuid>"
    if n == "content-security-policy":
        return re.sub(r"'nonce-[^']+'", "'nonce-<nonce>'", value)
    if n == "set-cookie":
        value = re.sub(r"connect\.sid=s%3A[^;]+", "connect.sid=<sid>", value)
        return re.sub(r"Expires=[^;]+", "Expires=<expires>", value)
    return value


def norm_json(value):
    if isinstance(value, dict):
        return {k: ("<ts>" if k == "timestamp" else norm_json(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [norm_json(v) for v in value]
    return value


def header_view(headers):
    view = []
    for k, v in headers:
        view.append((k.lower(), norm_header(k, v)))
    return view


def numeric_close(a, b):
    try:
        return abs(int(a) - int(b)) <= 1
    except ValueError:
        return False


def compare_headers(ha, hb):
    va, vb = header_view(ha), header_view(hb)
    diffs = []
    da, db = {}, {}
    for k, v in va:
        da.setdefault(k, []).append(v)
    for k, v in vb:
        db.setdefault(k, []).append(v)
    for k in sorted(set(da) | set(db)):
        a, b = da.get(k), db.get(k)
        if a == b:
            continue
        if a and b and len(a) == len(b) and k.startswith(("x-ratelimit-reset", "retry-after")) \
                and all(numeric_close(x, y) for x, y in zip(a, b)):
            continue
        diffs.append({"header": k, "a": a, "b": b, "transport": k in TRANSPORT})
    order_a = [k for k, _ in va if k not in TRANSPORT]
    order_b = [k for k, _ in vb if k not in TRANSPORT]
    return diffs, order_a != order_b


def etag_of(body):
    import base64, hashlib
    raw = body.encode("utf-8")
    return 'W/"%x-%s"' % (len(raw), base64.b64encode(hashlib.sha1(raw).digest()).decode()[:27])


def etag_masked(d, pa, pb):
    """ETag faible d'un corps JSON dont seul `timestamp` diffère : chaque côté doit
    appliquer la règle d'Express (W/"len-sha1" du corps envoyé) ; rien d'autre."""
    if d["header"] != "etag" or len(d["a"] or []) != 1 or len(d["b"] or []) != 1:
        return False
    ja, jb = pa.get("json"), pb.get("json")
    if not (isinstance(ja, dict) and isinstance(jb, dict)) or "timestamp" not in ja or "timestamp" not in jb:
        return False
    if ja["timestamp"] == jb["timestamp"] or norm_json(ja) != norm_json(jb):
        return False
    if not (d["a"][0].startswith('W/"') and d["b"][0].startswith('W/"')):
        return False
    return d["a"] == [etag_of(pa.get("body") or "")] and d["b"] == [etag_of(pb.get("body") or "")]


def html_projection(r):
    """Page SSR de Node (text/html) : nonce déclaré par le CSP de cette même réponse,
    horodatages ISO 8601 ms (new Date().toISOString()) et panier invité cart_<sessionID>
    (express-session en tire un à chaque requête sans cookie) → jetons ; le reste brut.
    None hors text/html ou si le corps n'a pas été conservé."""
    body = r.get("body")
    ct = [v for k, v in r.get("headers", []) if k.lower() == "content-type"]
    if body is None or len(ct) != 1 or not ct[0].startswith("text/html"):
        return None
    for k, v in r.get("headers", []):
        if k.lower() == "content-security-policy":
            for nonce in re.findall(r"'nonce-([^']+)'", v):
                body = body.replace(nonce, "<nonce>")
    return GUEST_CART_ID.sub("cart_<sid>", ISO_MS.sub("<iso>", body))


def compare_body(ra, rb):
    if "json" in ra or "json" in rb:
        return norm_json(ra.get("json")) == norm_json(rb.get("json"))
    if ra.get("body_sha256") == rb.get("body_sha256"):
        return True
    ha, hb = html_projection(ra), html_projection(rb)
    return ha is not None and ha == hb


def norm_session(s):
    if not s:
        return s
    value = s.get("value")
    if isinstance(value, dict) and isinstance(value.get("cookie"), dict):
        value = json.loads(json.dumps(value))
        value["cookie"]["expires"] = "<expires>"
    ttl = s.get("ttl")
    if isinstance(ttl, int) and ttl > 0:
        ttl = "≈30j" if abs(ttl - 2592000) <= 10 else ("≈20j" if abs(ttl - 1728000) <= 10 else ttl)
    return {"value": value, "ttl": ttl}


ISO_MS = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z")
# sessionID express-session : uid-safe de 24 octets → 32 caractères base64url.
GUEST_CART_ID = re.compile(r"cart_[A-Za-z0-9_-]{32}(?![A-Za-z0-9_-])")
ERR_CORRELATION = re.compile(r"err_\d{13}_[0-9a-z]{9}")
PINO_ID = re.compile(r"req-\d{13}-[0-9a-z]{1,11}")
UUID_V4 = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")


def stack_projection(stack):
    """Première ligne d'une pile (`Nom: message`) ; les cadres ne sont pas contractuels."""
    if not isinstance(stack, str):
        return stack
    head, sep, _ = stack.partition("\n")
    return head + ("\n<pile>" if sep else "")


def req_id_projection(value):
    if isinstance(value, str) and PINO_ID.fullmatch(value):
        return "<pino-id>"
    if isinstance(value, str) and UUID_V4.fullmatch(value):
        return "<uuid>"
    return value


def error_rows(writes):
    rows = []
    for w in writes.get("writes", []):
        if w["path"] != "/rest/v1/__error_logs":
            continue
        try:
            batch = json.loads(w["body"])
        except ValueError:
            rows.append({"illisible": w["body"][:200]})
            continue
        for row in batch if isinstance(batch, list) else [batch]:
            row = dict(row)
            v = row.get("err_created_at")
            if isinstance(v, str) and ISO_MS.fullmatch(v):
                row["err_created_at"] = "<iso>"
            v = row.get("err_correlation")
            if isinstance(v, str) and ERR_CORRELATION.fullmatch(v):
                row["err_correlation"] = "<corr>"
            if row.get("err_stack"):
                row["err_stack"] = stack_projection(row["err_stack"])
            ctx = row.get("err_context")
            if isinstance(ctx, dict) and isinstance(ctx.get("timestamp"), str) \
                    and ISO_MS.fullmatch(ctx["timestamp"]):
                row["err_context"] = {**ctx, "timestamp": "<iso>"}
            rows.append(row)
    return sorted(rows, key=lambda r: json.dumps(r, sort_keys=True))


def ns_norm(value, ns):
    """Préfixe d'IP propre à la capture (ns de meta.json) → <ns>, clés comprises."""
    prefix = f"2001:db8:{int(ns):x}::"
    if isinstance(value, str):
        return value.replace(prefix, "2001:db8:<ns>::")
    if isinstance(value, dict):
        return {ns_norm(k, ns): ns_norm(v, ns) for k, v in value.items()}
    if isinstance(value, list):
        return [ns_norm(v, ns) for v in value]
    return value


def norm_redis_delta(d, ns):
    d = json.loads(json.dumps(d or {}))
    for key in ("recent_blocks",):
        items = []
        for raw in d.get(key, []):
            try:
                item = json.loads(raw)
                item["timestamp"] = "<ts>" if "timestamp" in item else None
            except (ValueError, TypeError):
                item = raw
            items.append(item)
        if key in d:
            d[key] = items
    return ns_norm(d, ns)


# Contextes des tâches de fond de Node (files BullMQ répétées, démarrage) : sans
# `req`, ils écrivent à heure fixe sans lien avec la requête en cours (observé :
# SeoControlRefreshProcessor aux minutes paires, A2 actif pendant la capture R2).
BACKGROUND_LOG = re.compile(r"Processor$|^(OutboxRelay|Scheduler|Bull|RedisModule|NestApplication)")


def background_lines(lines_by_log):
    """Lignes écartées par log_projection, comptées par (journal, contexte)."""
    seen = {}
    for name in LOG_NAMES:
        for line in lines_by_log.get(name, []):
            try:
                j = json.loads(line)
            except ValueError:
                continue
            if isinstance(j, dict) and is_background(j):
                k = f"{name}:{j.get('context')}"
                seen[k] = seen.get(k, 0) + 1
    return seen


def is_background(j):
    ctx = j.get("context")
    return "req" not in j and isinstance(ctx, str) and bool(BACKGROUND_LOG.search(ctx))


def log_projection(lines_by_log, ns):
    """Champs contractuels d'une ligne : niveau, contexte, message, requête
    (méthode, URL, classe de l'id), statut, type/message d'erreur et première
    ligne de pile ; ni pid, ni horodatage, ni cadres de pile."""
    out = []
    for name in LOG_NAMES:
        for line in lines_by_log.get(name, []):
            try:
                j = json.loads(line)
            except ValueError:
                out.append(["brut", ns_norm(line.strip(), ns)])
                continue
            if not isinstance(j, dict):
                continue
            if is_background(j):
                continue
            req = j.get("req") or {}
            err = j.get("err") or {}
            out.append(ns_norm([j.get("level"), j.get("context"), j.get("msg"), req.get("method"),
                                req.get("url"), req_id_projection(req.get("id")),
                                (j.get("res") or {}).get("statusCode"),
                                err.get("type"), err.get("message"),
                                stack_projection(err.get("stack"))], ns))
    return sorted(out, key=lambda x: json.dumps(x, ensure_ascii=False))


def caddy_routes(lines):
    """(cas annoncé, amont choisi par Caddy ou None s'il a répondu seul, statut)."""
    routes = []
    for line in lines or []:
        try:
            j = json.loads(line)
        except ValueError:
            continue
        case = ((j.get("request") or {}).get("headers") or {}).get("X-Contract-Case", [None])[0]
        routes.append([case, j.get("upstream"), j.get("status")])
    return routes


def caddy_ts(j):
    return datetime.datetime.strptime(j["ts"], "%Y-%m-%dT%H:%M:%S.%f%z").timestamp()


def proxy_aborts(path):
    """Lignes reverse_proxy du journal général de Caddy (« aborting with incomplete
    response ») : l'amont a fermé la connexion avant la fin de la réponse. La ligne de
    requête n'a alors pas d'amont ; celle-ci le nomme. (cas annoncé, IP cliente) →
    [(instant, amont)]."""
    aborts = {}
    for line in path.read_text(errors="replace").splitlines() if path.exists() else []:
        try:
            j = json.loads(line)
        except ValueError:
            continue
        if j.get("logger") != "http.handlers.reverse_proxy" or not isinstance(j.get("ts"), str):
            continue
        req = j.get("request") or {}
        case = (req.get("headers") or {}).get("X-Contract-Case", [None])[0]
        aborts.setdefault((case, req.get("client_ip")), []).append((caddy_ts(j), j.get("upstream")))
    return aborts


def app_requests(lines):
    """Lignes d'un journal applicatif rattachées à une requête (champ `req`)."""
    n = 0
    for line in lines or []:
        try:
            j = json.loads(line)
        except ValueError:
            continue
        if isinstance(j, dict) and j.get("req"):
            n += 1
    return n


CADDY_ERROR_BODY = "Une erreur est survenue. Veuillez reessayer plus tard."  # handle_errors @500


def cmd_backend_outage(selection, base, out, ns):
    """Panne de l'amont de la sélection (r2 en rust, a2 en node) derrière Caddy, puis reprise.
    Attendu pendant la panne : la route répond la page 500 de handle_errors, ni A2 ni R2 ne
    journalisent la requête (aucun repli) ; une exclusion reste servie par Node en rust, échoue
    en node. Après reprise : la route revient sur l'amont de la sélection."""
    assert_bench_redis()
    out_dir = pathlib.Path(out)
    if out_dir.exists():
        die(f"{out_dir} existe déjà")
    out_dir.mkdir(parents=True, mode=0o700)
    target = {"rust": "r2", "node": "a2"}[selection]
    corpus = Corpus("caddy", int(ns), bench_secrets())
    access = OUT / "caddy-access.log"
    steps, failures = [], []
    cursor = log_offsets()
    access_at = access.stat().st_size if access.exists() else 0

    def probe(label, path, eligible, want, expect=200):
        nonlocal cursor, access_at
        r = send(base, "GET", path, corpus.headers(label, corpus.ip()))
        time.sleep(0.5)
        logs, cursor = log_lines_since(cursor)
        with open(access, "rb") as src:
            src.seek(access_at)
            chunk = src.read()
        access_at += chunk.rfind(b"\n") + 1
        errors = [l for l in chunk.decode("utf-8", "replace").splitlines() if '"level":"error"' in l]
        mine = [x for x in caddy_routes(logs.get("caddy")) if x[0] == label]
        a2, r2 = app_requests(logs.get("a2")), app_requests(logs.get("r2"))
        status = r.get("status")
        problems = []
        if len(mine) != 1:
            problems.append(f"{len(mine)} ligne(s) Caddy")
        if want == "erreur":
            if status != 500 or r.get("body") != CADDY_ERROR_BODY:
                problems.append(f"page 500 de Caddy attendue, reçu {status} {(r.get('body') or '')[:80]!r}")
            if a2 or r2:
                problems.append(f"repli : a2={a2} r2={r2}")
            # handle_errors traite l'erreur de proxy : Caddy n'en écrit pas de ligne au niveau
            # INFO (observé 2026-10-22) ; sa ligne de requête passe au niveau error.
            if [json.loads(l).get("level") for l in logs.get("caddy", []) if label in l] != ["error"]:
                problems.append("ligne Caddy de niveau error attendue")
        else:
            if status != expect:
                problems.append(f"{expect} attendu, reçu {status}")
            if any(x[1] != UPSTREAM[want] for x in mine):
                problems.append(f"amont {[x[1] for x in mine]} ≠ {UPSTREAM[want]}")
            if (r2 if want == "node" else a2):
                problems.append(f"amont inattendu : a2={a2} r2={r2}")
        steps.append({"id": label, "target": path, "éligible": eligible, "attendu": want, "response": r,
                      "caddy": mine, "lignes_a2": a2, "lignes_r2": r2, "erreurs_proxy": errors,
                      "logs": logs, "problèmes": problems})
        failures.extend(f"{label}: {p}" for p in problems)
        print(f"{label:<22} {status or r.get('error')} {'; '.join(problems)}")

    route = "/api/vehicles/brands/173/models?year=1995&page=0&limit=100"
    # Exclusion voisine (cas p068) : %2F décodé par Caddy hors de @vehicle_models, @private → Node,
    # 400 sans lecture ni écriture. Pas /health : la route par défaut porte un contrôle de santé
    # actif (30 s) qui la ferme après un redémarrage de Node, quelle que soit la sélection.
    other, other_status = "/api/vehicles/brands/1%2F2/models", 400
    probe("u-before", route, True, selection)
    probe("u-before-excl", other, False, "node", other_status)
    pid = (OUT / "pids" / f"{target}.pid").read_text().strip()
    code, msg = route_sh("stop", target)
    alive = pathlib.Path(f"/proc/{pid}").exists()
    steps.append({"id": f"stop {target}", "rc": code, "out": msg, "pid": pid, "vivant_après": alive})
    if code or alive:
        failures.append(f"arrêt de {target} ({pid}) non prouvé : rc={code}, vivant={alive}")
    probe("u-down", "/api/vehicles/brands/173/models?year=2008&page=0&limit=100", True, "erreur")
    probe("u-down-excl", other, False, "node" if selection == "rust" else "erreur", other_status)
    code, msg = route_sh("start", target)
    steps.append({"id": f"start {target}", "rc": code, "out": msg})
    cursor[target] = 0  # route.sh start réécrit le journal du processus relancé
    probe("u-back", "/api/vehicles/brands/128/models?year=1995&page=0&limit=100", True, selection)
    probe("u-back-excl", other, False, "node", other_status)
    (out_dir / "backend-outage.json").write_text(json.dumps(
        {"sélection": selection, "arrêté": target, "échecs": failures, "étapes": steps},
        indent=1, ensure_ascii=False) + "\n")
    print(f"contract: panne {target} ({selection}) → {out_dir}, {len(failures)} écart(s) à l'attendu")
    if failures:
        sys.exit(1)


def cmd_budget(selection, base, out, ns):
    """Budget du limiteur d'un même client entre la route et une exclusion servie par Node
    qui atteint le même handler Nest (cas p068). Le compteur de @nestjs/throttler est par
    (contrôleur, handler, palier, IP) ; Node (RedisThrottlerStorage) et la route (R2) le
    tiennent dans le même Redis : un seul budget dans les deux sélections. Avant ce stockage,
    chaque processus le tenait en mémoire et R2 en ajoutait un second (99, 99, 98, 98… en
    rust). Les autres routes /api ont leur propre budget. Mesure brute, jamais normalisée.
    Lu sur le palier medium (100/min) : sa fenêtre couvre la série, celle du palier short
    (15/s) peut se renouveler en cours de série."""
    assert_bench_redis()
    out_dir = pathlib.Path(out)
    if out_dir.exists():
        die(f"{out_dir} existe déjà")
    out_dir.mkdir(parents=True, mode=0o700)
    corpus = Corpus("caddy", int(ns), bench_secrets())
    ip = corpus.ip()
    other = "/api/vehicles/brands/1%2F2/models"
    steps, failures = [], []
    cursor = log_offsets()
    for i in range(6):
        for kind, path, want in (("route", YEAR_PATH, selection), ("exclusion", other, "node")):
            label = f"t-{kind}-{i}"
            r = send(base, "GET", path, corpus.headers(label, ip))
            h = {k.lower(): v for k, v in r.get("headers", [])}
            steps.append({"id": label, "type": kind, "target": path, "amont_attendu": UPSTREAM[want],
                          "status": r.get("status", r.get("error")),
                          "restant": {k: v for k, v in h.items() if k.startswith("x-ratelimit-remaining-")}})
    time.sleep(0.5)
    logs, _ = log_lines_since(cursor)
    served = {case: up for case, up, _ in caddy_routes(logs.get("caddy"))}
    for s in steps:
        s["amont"] = served.get(s["id"])
        if s["amont"] != s["amont_attendu"]:
            failures.append(f"{s['id']}: amont {s['amont']} ≠ {s['amont_attendu']}")
        if s["status"] != {"route": 200, "exclusion": 400}[s["type"]]:
            failures.append(f"{s['id']}: statut {s['status']}")
    medium = [s["restant"].get("x-ratelimit-remaining-medium") for s in steps]
    if None in medium:
        failures.append("X-RateLimit-Remaining-medium absent d'une réponse")
    else:
        got = [int(v) for v in medium]
        want = list(range(99, 99 - len(steps), -1))
        if got != want:
            failures.append(f"restant medium {got} ≠ attendu {want}")
    (out_dir / "budget.json").write_text(json.dumps(
        {"sélection": selection, "ip": ip, "échecs": failures, "étapes": steps, "logs": logs},
        indent=1, ensure_ascii=False) + "\n")
    print(f"restant medium : {medium}")
    print(f"contract: budget ({selection}) → {out_dir}, {len(failures)} écart(s) à l'attendu")
    if failures:
        sys.exit(1)


def cmd_scope(base, out, ns):
    """Périmètre de R2 en direct : une requête valide sans année (cache LRU de Node, que
    Caddyfile.route laisse à Node) reçoit 421 sans corps, sans cookie, sans ligne de
    journal, sans appel au rejeu ni effet Redis ; deux témoins avec année montrent que
    ces mesures voient bien un effet."""
    assert_bench_redis()
    out_dir = pathlib.Path(out)
    if out_dir.exists():
        die(f"{out_dir} existe déjà")
    out_dir.mkdir(parents=True, mode=0o700)
    corpus = Corpus("direct", int(ns), bench_secrets())
    ip = corpus.ip()
    cases = [
        ("s-noyear", "GET", ROUTE.format(151), 421),
        ("s-noyear-head", "HEAD", ROUTE.format(151), 421),
        ("s-noyear-page", "GET", ROUTE.format(140) + "?page=1&limit=10", 421),
        ("s-year-empty", "GET", ROUTE.format(164) + "?year=", 421),
        ("s-search", "GET", ROUTE.format(164) + "?search=a", 421),
        ("s-year-after-1000", "GET", ROUTE.format(164) + "?" + "&" * 1000 + "year=2008", 421),
        ("s-year", "GET", YEAR_PATH, 200),
        ("s-year-invalid", "GET", ROUTE.format(164) + "?year=1800", 400),
    ]
    steps, failures = [], []
    for label, method, target, want in cases:
        before, stats, cursor = settled_state(), replay_stats(), log_offsets()
        r = send(base, method, target, corpus.headers(label, ip))
        time.sleep(0.3)
        after, stats_after = settled_state(), replay_stats()
        logs, _ = log_lines_since(cursor)
        h = {k.lower(): v for k, v in r.get("headers", [])}
        step = {"id": label, "method": method, "target": target[:120], "attendu": want,
                "status": r.get("status", r.get("error")), "raw_len": r.get("raw_len"),
                "set_cookie": "set-cookie" in h, "r2_lignes": len(logs.get("r2") or []),
                "rejeu_change": stats != stats_after, "redis": redis_delta(before, after)}
        steps.append(step)
        if step["status"] != want:
            failures.append(f"{label}: statut {step['status']} ≠ {want}")
        if want == 421:
            if step["raw_len"] != 0 or step["set_cookie"] or step["r2_lignes"] or step["rejeu_change"] \
                    or step["redis"]:
                failures.append(f"{label}: effet d'une requête refusée {step}")
        elif not step["r2_lignes"]:
            failures.append(f"{label}: témoin sans ligne de journal R2")
    if not any(s["rejeu_change"] for s in steps if s["attendu"] == 200):
        failures.append("témoin s-year sans appel au rejeu : la mesure ne voit rien")
    (out_dir / "scope.json").write_text(json.dumps(
        {"base": base, "ip": ip, "échecs": failures, "étapes": steps}, indent=1, ensure_ascii=False) + "\n")
    for s in steps:
        print(f"  {s['id']:<20} {s['status']} r2={s['r2_lignes']} rejeu={s['rejeu_change']} redis={bool(s['redis'])}")
    print(f"contract: scope → {out_dir}, {len(failures)} écart(s) à l'attendu")
    if failures:
        sys.exit(1)

def cmd_diff_outages(a, b, ns_a, ns_b, report=None):
    """Compare deux séquences de pannes étape par étape : statut, corps, en-têtes
    sémantiques, journal contractuel ; puis les lignes `__error_logs` reçues."""
    sa = json.loads((pathlib.Path(a) / "outages.json").read_text())
    sb = json.loads((pathlib.Path(b) / "outages.json").read_text())
    out = []
    for xa, xb in zip(sa, sb):
        e = {"id": xa["id"]}
        if xa["id"] != xb["id"]:
            e["séquence"] = [xa["id"], xb["id"]]
        pa, pb = xa.get("response"), xb.get("response")
        if pa is not None or pb is not None:
            pa, pb = pa or {}, pb or {}
            if pa.get("status") != pb.get("status") or bool(pa.get("error")) != bool(pb.get("error")):
                e["status"] = [pa.get("status", pa.get("error")), pb.get("status", pb.get("error"))]
            elif not compare_body(pa, pb):
                e["body"] = [(pa.get("body") or "")[:300], (pb.get("body") or "")[:300]]
            hd, _ = compare_headers(pa.get("headers", []), pb.get("headers", []))
            hd = [d for d in hd if not d["transport"] and not etag_masked(d, pa, pb)]
            if hd:
                e["headers"] = hd
        if "logs" in xa or "logs" in xb:
            la, lb = log_projection(xa.get("logs") or {}, ns_a), log_projection(xb.get("logs") or {}, ns_b)
            if la != lb:
                e["logs"] = [la, lb]
        if "writes" in xa:
            ea = sorted((ns_norm(r, ns_a) for r in error_rows(xa["writes"])), key=lambda r: json.dumps(r, sort_keys=True))
            eb = sorted((ns_norm(r, ns_b) for r in error_rows(xb["writes"])), key=lambda r: json.dumps(r, sort_keys=True))
            if ea != eb:
                e["error_log"] = [ea, eb]
        if len(e) > 1:
            out.append(e)
    if len(sa) != len(sb):
        out.append({"id": "longueur", "séquence": [len(sa), len(sb)]})
    text = json.dumps({"a": a, "b": b, "écarts": out}, indent=1, ensure_ascii=False)
    if report:
        pathlib.Path(report).write_text(text + "\n")
    for e in out:
        print(f"  {e['id']:<28} {','.join(k for k in e if k != 'id')}")
    print(f"pannes : {len(sa)} étapes, {len(out)} avec écart")


UPSTREAM = {"node": "127.0.0.1:3140", "rust": "127.0.0.1:3150"}


# Règle @vehicle_models de Caddyfile.route, réécrite ici pour attendre un amont sans
# le déduire de la réponse : GET/HEAD, chemin décodé puis nettoyé (barres doubles
# fusionnées, `.`/`..` résolus, barre finale gardée), sensible à la casse, et année :
# valeurs de `year` lues comme url.ParseQuery de Go (paire à « ; » ou à échappement
# invalide ignorée, `+` = espace) jointes par une virgule, au plus 1000 paires brutes.
ELIGIBLE_PATH = re.compile(r"/api/vehicles/brands/[^/]+/models/?")
ELIGIBLE_YEAR = re.compile(r"[1-9][0-9]{3}")
BAD_ESCAPE = re.compile(r"%(?![0-9A-Fa-f]{2})")


def caddy_year(raw_query):
    values = []
    for part in raw_query.split("&"):
        key, _, value = part.partition("=")
        if not part or ";" in part or BAD_ESCAPE.search(part):
            continue
        if urllib.parse.unquote_plus(key, errors="surrogateescape") == "year":
            values.append(urllib.parse.unquote_plus(value, errors="surrogateescape"))
    return ",".join(values)


def caddy_eligible(method, target):
    """True/False selon la règle ; None si le chemin porte un échappement invalide,
    que le serveur HTTP de Caddy refuse avant tout routage."""
    raw, _, raw_query = target.partition("?")
    if BAD_ESCAPE.search(raw):
        return None
    path = urllib.parse.unquote(raw, errors="strict")
    trailing = path.endswith("/")
    path = posixpath.normpath(re.sub(r"/+", "/", path))
    if trailing and path != "/":
        path += "/"
    return (method in ("GET", "HEAD") and ELIGIBLE_PATH.fullmatch(path) is not None
            and ELIGIBLE_YEAR.fullmatch(caddy_year(raw_query)) is not None
            and len(raw_query.split("&")) <= 1000)


# Refus du serveur HTTP de Caddy avant tout routage : aucune ligne de requête, aucun amont.
# Chemin à échappement invalide (caddy_eligible → None) et, déclaré ici, une tête au-delà
# de la limite de Caddy (20 777 octets refusés, 19 047 transmis : sondes du 2026-10-22).
FRONT_REFUSED = {"q-headers-20k": 431}


def front_refusal(case):
    """Réponse brute de net/http (Go) : « <statut> <raison> » en text/plain, Connection: close."""
    r = case.get("response") or {}
    h = {k.lower(): v for k, v in r.get("headers", [])}
    return (set(h) == {"content-type", "connection"} and h["content-type"] == "text/plain; charset=utf-8"
            and h["connection"] == "close" and r.get("body") == f"{r.get('status')} {r.get('reason')}")


def cmd_routes(capture, selection, report=None):
    """Preuve de destination d'une capture derrière Caddy : chaque requête d'un cas
    doit porter son X-Contract-Case dans le journal Caddy, avec l'amont attendu ;
    en sélection rust, A2 ne journalise aucune requête d'un cas éligible et R2
    aucune requête d'un cas exclu."""
    d = pathlib.Path(capture)
    cases = [json.loads(l) for l in (d / "cases.jsonl").read_text().splitlines()]
    aborts = proxy_aborts(OUT / "caddy-access.log")
    out, bad = [], 0
    for c in cases:
        routes = caddy_routes((c.get("logs") or {}).get("caddy"))
        mine = [r for r in routes if r[0] == c["id"]]
        foreign = [r for r in routes if r[0] != c["id"]]
        eligible = caddy_eligible(c["method"], c["target"])
        want = UPSTREAM[selection] if eligible else UPSTREAM["node"]
        ups = sorted({str(r[1]) for r in mine})
        a2 = app_requests((c.get("logs") or {}).get("a2"))
        r2 = app_requests((c.get("logs") or {}).get("r2"))
        problems = []
        refused = FRONT_REFUSED.get(c["id"]) or (400 if eligible is None else None)
        if refused:
            status = (c.get("response") or {}).get("status")
            if c["repeat"] != 1 or routes or a2 or r2 or status != refused or not front_refusal(c):
                problems.append(f"refus {refused} de Caddy attendu : statut {status}, {len(routes)} ligne(s) "
                                f"Caddy, a2={a2}, r2={r2}, signature net/http={front_refusal(c)}")
        elif len(mine) != c["repeat"]:
            problems.append(f"{len(mine)} ligne(s) Caddy pour {c['repeat']} requête(s)")
        if any(r[1] not in (want, None) for r in mine):
            problems.append(f"amont {ups} ≠ {want}")
        # Ligne de requête sans amont : admise seulement si reverse_proxy nomme, à moins
        # d'une seconde et pour la même IP cliente, l'amont attendu (course de q-url-20k,
        # § 9 de route-contract.md). Une réponse de Caddy seul reste en défaut.
        cuts = []
        for line in (c.get("logs") or {}).get("caddy") or []:
            try:
                j = json.loads(line)
            except ValueError:
                continue
            req = j.get("request") or {}
            if (req.get("headers") or {}).get("X-Contract-Case", [None])[0] != c["id"] or j.get("upstream"):
                continue
            named = sorted({up for t, up in aborts.get((c["id"], req.get("client_ip")), [])
                            if abs(t - caddy_ts(j)) <= 1})
            cuts.append(named)
            if named != [want]:
                problems.append(f"ligne Caddy sans amont, coupure reverse_proxy {named} ≠ {want}")
        if foreign:
            problems.append(f"lignes Caddy d'un autre cas : {foreign[:3]}")
        if selection == "rust" and eligible and a2:
            problems.append(f"A2 a journalisé {a2} requête(s)")
        if not eligible and r2:
            problems.append(f"R2 a journalisé {r2} requête(s)")
        bad += bool(problems)
        out.append({"id": c["id"], "scope": c["scope"], "éligible": eligible, "refus_caddy": refused,
                    "repeat": c["repeat"], "amont": ups, "coupures": cuts,
                    "statuts": sorted({r[2] for r in mine}), "lignes_a2": a2, "lignes_r2": r2,
                    "problèmes": problems})
    text = json.dumps({"capture": str(d), "sélection": selection, "cas": len(out), "en_défaut": bad,
                       "cas_détail": out}, indent=1, ensure_ascii=False)
    if report:
        pathlib.Path(report).write_text(text + "\n")
    for e in out:
        if e["problèmes"] or not e["éligible"]:
            print(f"  {e['id']:<22} {e['scope']:<6} {e['éligible']!s:<5} {e['amont']} {e['statuts']} a2={e['lignes_a2']} "
                  f"r2={e['lignes_r2']} {'; '.join(e['problèmes'])}")
    print(f"routes: {len(out)} cas, {bad} en défaut ({selection})")
    if bad:
        sys.exit(1)


def completions(path):
    """Lignes de fin pino-http (res + responseTime) d'un journal applicatif du banc."""
    rows = []
    for line in path.read_text(errors="replace").splitlines() if path.exists() else []:
        try:
            j = json.loads(line)
        except ValueError:
            continue
        if isinstance(j, dict) and j.get("req") and j.get("res") and "responseTime" in j:
            rows.append(j)
    return rows


def cmd_journey_routes(journey, selection, report=None):
    """Un appel du navigateur n'a pas d'en-tête de cas : il est rattaché à Caddy par
    l'X-Request-Id de sa réponse (unique), puis au processus par sa ligne de fin
    (même méthode, URL et statut, fin dans la durée Caddy à 1 s près). Deux appels
    identiques simultanés (deux balises CWV) se partagent leurs candidates : chaque
    ligne de fin est attribuée à un seul appel, la plus proche de la fin Caddy ; une
    candidate restée sans appel est un doublon, signalé."""
    j = json.loads(pathlib.Path(journey).read_text())
    by_rid = {}
    for line in (OUT / "caddy-requests.log").read_text(errors="replace").splitlines():
        try:
            c = json.loads(line)
        except ValueError:
            continue
        for rid in (c.get("resp_headers") or {}).get("X-Request-Id", []):
            by_rid.setdefault(rid, []).append(c)
    ends = {n: completions(OUT / "logs" / f"{n}.log") for n in ("a2", "r2")}
    out, pending = [], []
    for call in j.get("calls", []):
        rid = call["response"].get("x-request-id")
        eligible = caddy_eligible(call["method"], call["path"])
        want = UPSTREAM[selection] if eligible else UPSTREAM["node"]
        problems, row = [], {"method": call["method"], "path": call["path"], "status": call["status"],
                             "eligible": eligible, "want": want, "x_request_id": bool(rid)}
        lines = by_rid.get(rid, []) if rid else []
        if len(lines) != 1:
            problems.append(f"{len(lines)} ligne(s) Caddy pour l'X-Request-Id")
        else:
            c = lines[0]
            end = datetime.datetime.fromisoformat(c["ts"]).timestamp() * 1000
            start = end - float(c.get("duration") or 0) * 1000
            row.update(upstream=c.get("upstream"), caddy_status=c.get("status"))
            if c.get("upstream") != want:
                problems.append(f"amont {c.get('upstream')} au lieu de {want}")
            if c.get("status") != call["status"]:
                problems.append(f"statut Caddy {c.get('status')} ≠ navigateur {call['status']}")
            cand = {n: [i for i, e in enumerate(rows) if e["req"].get("method") == call["method"]
                        and e["req"].get("url") == call["path"]
                        and e["res"].get("statusCode") == call["status"]
                        and start - 1000 <= e["time"] <= end + 1000] for n, rows in ends.items()}
            row["completions"] = {n: len(v) for n, v in cand.items()}
            served = "r2" if want == UPSTREAM["rust"] else "a2"
            other = "a2" if served == "r2" else "r2"
            if cand[other]:
                problems.append(f"{len(cand[other])} ligne(s) de fin dans {other}, attendu 0")
            pending.append((row, served, end, cand[served]))
        row["problems"] = problems
        out.append(row)
    # attribution un à un, de l'écart le plus faible au plus fort
    taken = {}
    pairs = sorted((abs(ends[sv][i]["time"] - end), k, sv, i)
                   for k, (_, sv, end, idx) in enumerate(pending) for i in idx)
    got = {}
    for _, k, sv, i in pairs:
        if k not in got and (sv, i) not in taken:
            got[k] = taken[(sv, i)] = k
    for k, (row, sv, _, idx) in enumerate(pending):
        if k not in got:
            row["problems"].append(f"aucune ligne de fin libre dans {sv}")
        else:
            row["completion_pid"] = ends[sv][next(i for i in idx if taken.get((sv, i)) == k)].get("pid")
    for (sv, i) in {(sv, i) for _, (_, sv, _, idx) in enumerate(pending) for i in idx} - set(taken):
        e = ends[sv][i]
        out.append({"method": e["req"].get("method"), "path": e["req"].get("url"),
                    "status": e["res"].get("statusCode"), "upstream": None,
                    "problems": [f"ligne de fin {sv} sans appel du navigateur (doublon)"]})
    bad = 0
    for row in out:
        if row["problems"]:
            bad += 1
        else:
            del row["problems"]
    steps = {s["name"]: s for s in j.get("steps", [])}
    summary = {"journey": str(journey), "ok": j.get("ok"), "error": j.get("error"),
               "selection": selection, "appels": len(out), "en_défaut": bad,
               "modèles_reçus": steps.get("modèles reçus"), "liste_affichée": steps.get("liste des modèles affichée"),
               "erreurs_page": j.get("page_errors")}
    if report:
        pathlib.Path(report).write_text(json.dumps({"summary": summary, "appels": out}, indent=1,
                                                   ensure_ascii=False) + "\n")
    print(json.dumps(summary, ensure_ascii=False))
    for r in out:
        print(f"  {r['method']:<4} {r['status']} {r.get('upstream')} {r['path'][:80]}"
              + (f"  ÉCART {r['problems']}" if r.get("problems") else ""))


def cmd_diff(a, b, report=None):
    da, db = pathlib.Path(a), pathlib.Path(b)

    def load(d):
        return {r["id"]: r for r in map(json.loads, (d / "cases.jsonl").read_text().splitlines())}
    ca, cb = load(da), load(db)
    na = json.loads((da / "meta.json").read_text())["ns"]
    nb = json.loads((db / "meta.json").read_text())["ns"]
    out = {"a": str(da), "b": str(db), "normalisations": NORMALISATIONS, "cases": [], "summary": {}}
    rows_a = error_rows(json.loads((da / "writes.json").read_text())) if (da / "writes.json").exists() else None
    rows_b = error_rows(json.loads((db / "writes.json").read_text())) if (db / "writes.json").exists() else None

    def case_rows(rows, ip, ns):
        return sorted((ns_norm(r, ns) for r in rows or [] if r.get("err_ip") == ip),
                      key=lambda r: json.dumps(r, sort_keys=True))
    counts = {"identiques": 0, "écarts": 0, "ordre seul": 0, "absents": 0}
    background = {}
    for cid in list(ca) + [k for k in cb if k not in ca]:
        ra, rb = ca.get(cid), cb.get(cid)
        if not ra or not rb:
            counts["absents"] += 1
            out["cases"].append({"id": cid, "absent": "a" if not ra else "b"})
            continue
        pa, pb = ra["response"], rb["response"]
        hd, order = compare_headers(pa.get("headers", []), pb.get("headers", []))
        hd = [d for d in hd if not etag_masked(d, pa, pb)]
        entry = {"id": cid, "group": ra["group"], "scope": ra["scope"]}
        if pa.get("status") != pb.get("status") or pa.get("error") != pb.get("error"):
            entry["status"] = [pa.get("status", pa.get("error")), pb.get("status", pb.get("error"))]
        if not compare_body(pa, pb):
            entry["body"] = [(pa.get("body") or "")[:300], (pb.get("body") or "")[:300]]
        semantic = [d for d in hd if not d["transport"]]
        if semantic:
            entry["headers"] = semantic
        transport = [d for d in hd if d["transport"]]
        if transport:
            entry["transport"] = transport
        if ra.get("series") or rb.get("series"):
            sa = [s["status"] for s in ra.get("series", [])]
            sb = [s["status"] for s in rb.get("series", [])]
            if sa != sb:
                entry["series"] = [sa, sb]
        if (ra.get("db") or {}).get("hits") != (rb.get("db") or {}).get("hits") or \
                (ra.get("db") or {}).get("misses") != (rb.get("db") or {}).get("misses"):
            entry["db"] = [ra.get("db"), rb.get("db")]
        if "session_after" in ra or "session_after" in rb:
            sa, sb = norm_session(ra.get("session_after")), norm_session(rb.get("session_after"))
            if sa != sb:
                entry["session_after"] = [sa, sb]
        if "redis" in ra or "redis" in rb:
            xa, xb = norm_redis_delta(ra.get("redis"), na), norm_redis_delta(rb.get("redis"), nb)
            if xa != xb:
                entry["redis"] = [xa, xb]
        if rows_a is not None and rows_b is not None:
            ea_, eb_ = case_rows(rows_a, ra["ip"], na), case_rows(rows_b, rb["ip"], nb)
            if ea_ != eb_:
                entry["error_log"] = [ea_, eb_]
        if "logs" in ra or "logs" in rb:
            la, lb = log_projection(ra.get("logs") or {}, na), log_projection(rb.get("logs") or {}, nb)
            if la != lb:
                entry["logs"] = [la, lb]
            for side, r in (("a", ra), ("b", rb)):
                for k, n in background_lines(r.get("logs") or {}).items():
                    background[f"{side}:{k}"] = background.get(f"{side}:{k}", 0) + n
        if order:
            entry["order"] = True
        keys = set(entry) - {"id", "group", "scope", "order", "transport"}
        if keys:
            counts["écarts"] += 1
        elif order or transport:
            counts["ordre seul"] += 1
        else:
            counts["identiques"] += 1
        if set(entry) - {"id", "group", "scope"}:
            out["cases"].append(entry)
    out["summary"] = counts
    out["logs_background"] = background
    wa = da / "writes.json"
    wb = db / "writes.json"
    if wa.exists() and wb.exists():
        ea = sorted((ns_norm(r, na) for r in rows_a), key=lambda r: json.dumps(r, sort_keys=True))
        eb = sorted((ns_norm(r, nb) for r in rows_b), key=lambda r: json.dumps(r, sort_keys=True))
        out["error_log"] = {"a": len(ea), "b": len(eb), "identiques": ea == eb}
        if ea != eb:
            out["error_log"]["a_rows"], out["error_log"]["b_rows"] = ea, eb
    ra_, rb_ = da / "redis.json", db / "redis.json"
    if ra_.exists() and rb_.exists():
        sa, sb = ns_norm(json.loads(ra_.read_text()), na), ns_norm(json.loads(rb_.read_text()), nb)
        out["redis_hors_perimetre"] = {}
        for side, s in (("a", sa), ("b", sb)):
            fam = s.get("keys", {})
            out["redis_hors_perimetre"][side] = sorted(k for k in fam if not k.startswith(REDIS_SCOPE))
            s["keys"] = {k: (v if not k.startswith(MINUTE_STATS) else "≥1") for k, v in fam.items()
                         if k.startswith(REDIS_SCOPE)}
        for s in (sa, sb):
            for blk in s.get("recent_blocks", []):
                if isinstance(blk, dict):
                    blk["timestamp"] = "<ts>"
            s["recent_blocks_ttl"] = "≈1j" if str(s.get("recent_blocks_ttl", "")).isdigit() \
                and abs(int(s["recent_blocks_ttl"]) - 86400) <= 60 else s.get("recent_blocks_ttl")
            for v in s.get("vbot", {}).values():
                v["ttl"] = "set" if str(v.get("ttl", "")).isdigit() else v.get("ttl")
        out["redis"] = {k: sa.get(k) == sb.get(k) for k in ("keys", "stats", "recent_blocks", "vbot")}
        out["redis_detail"] = {k: [sa.get(k), sb.get(k)] for k, same in out["redis"].items() if not same}
    text = json.dumps(out, indent=1, ensure_ascii=False)
    if report:
        pathlib.Path(report).write_text(text + "\n")
    print(json.dumps({"summary": counts, "error_log": out.get("error_log", {}).get("identiques"),
                      "redis": out.get("redis")}, ensure_ascii=False))
    for e in out["cases"]:
        flags = [k for k in e if k not in ("id", "group", "scope")]
        print(f"  {e['id']:<24} {e.get('scope', ''):<6} {','.join(flags)}")


def main():
    args = sys.argv[1:]
    if not args:
        die(__doc__)
    cmd = args[0]
    if cmd == "fixtures" and len(args) == 2:
        if pathlib.Path(args[1]).exists():
            die(f"{args[1]} existe déjà")
        with open(args[1], "w") as f:
            for row in fixture_lines():
                f.write(json.dumps(row) + "\n")
    elif cmd == "prepare" and len(args) == 1:
        assert_bench_redis()
        redis("FLUSHDB")
        redis("SET", "bot-guard:config", json.dumps(CONTRACT_BOT_CONFIG))
        print("contract: Redis du banc vidé, configuration BotGuard du contrat posée")
    elif cmd == "capture" and len(args) >= 6:
        cmd_capture(args[1], args[2], args[3], args[4], args[5:])
    elif cmd == "probes" and len(args) == 5:
        cmd_capture(*args[1:], path_files=(), builder=build_probe_corpus)
    elif cmd == "outages" and len(args) == 5:
        cmd_outages(*args[1:])
    elif cmd == "backend-outage" and len(args) == 5 and args[1] in UPSTREAM:
        cmd_backend_outage(*args[1:])
    elif cmd == "budget" and len(args) == 5 and args[1] in UPSTREAM:
        cmd_budget(*args[1:])
    elif cmd == "scope" and len(args) == 4:
        cmd_scope(*args[1:])
    elif cmd == "diff" and len(args) in (3, 4):
        cmd_diff(*args[1:])
    elif cmd == "diff-outages" and len(args) in (5, 6):
        cmd_diff_outages(*args[1:])
    elif cmd == "journey-routes" and len(args) in (3, 4) and args[2] in UPSTREAM:
        cmd_journey_routes(*args[1:])
    elif cmd == "routes" and len(args) in (3, 4) and args[2] in UPSTREAM:
        cmd_routes(*args[1:])
    else:
        die(__doc__)


if __name__ == "__main__":
    main()
