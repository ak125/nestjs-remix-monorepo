#!/usr/bin/env bash
# PreToolUse hook for Supabase MCP tools (apply_migration, execute_sql).
# Contrat appliqué : base en lecture seule pour les agents
# (.claude/skills/amk-supabase-postgres-best-practices/SKILL.md, règles 1 et 2) :
#   - execute_sql : seules les lectures passent (SELECT, WITH sans écriture, VALUES,
#     TABLE, SHOW, EXPLAIN d'une lecture) ; tout le reste est refusé (DDL, DML, GRANT,
#     DO, COPY, CALL, SET, transaction…), y compris dans une requête à plusieurs
#     instructions.
#   - apply_migration : toujours refusé. Une migration passe par un fichier de
#     backend/supabase/migrations/ et le workflow du dépôt (skill db-migration).
# Liste d'autorisation, pas liste de refus : un motif absent est refusé.
# Limite connue : un SELECT qui appelle une fonction qui écrit (RPC volatile) passe,
# hors de la courte liste de fonctions d'administration refusées ci-dessous. La
# frontière effective reste côté base (rôle en lecture seule) ; ce hook n'en est
# qu'une protection d'agent.
# Lecture lexicale fermée : une construction dont la lecture par PostgreSQL est
# incertaine ($ ou chaîne collés à un identifiant ou un nombre, U&"…", chaîne,
# commentaire ou identifiant non fermé) est refusée plutôt que devinée. Supposé :
# standard_conforming_strings = on (défaut ; SET est refusé par ce hook).
# Exit 0 = allow, Exit 2 = block (stderr shown to the model).

if ! command -v jq &>/dev/null; then
  echo "BLOCKED: jq requis pour les hooks de securite. Installer: apt install jq" >&2
  exit 2
fi
if ! command -v python3 &>/dev/null; then
  echo "BLOCKED: python3 requis pour la garde Supabase (analyse SQL). Garde en echec ferme." >&2
  exit 2
fi

set -euo pipefail

# Read tool input from stdin (JSON): exactly one object, argument in tool_input.
# Unreadable envelope → block (fail closed): allowing it would silence every guard
# below on the first envelope format change.
INPUT=$(cat)
if ! QUERY=$(jq -ers '
    if length == 1 and (.[0] | type) == "object" and (.[0].tool_input | type) == "object"
    then .[0].tool_input.query else error("envelope") end
    | select(type == "string" and test("\\S"))' <<<"$INPUT" 2>/dev/null); then
  echo "BLOCKED: enveloppe PreToolUse illisible (objet JSON avec tool_input.query non vide attendu). Garde en echec ferme." >&2
  exit 2
fi
TOOL_NAME=$(jq -r '.tool_name // ""' <<<"$INPUT")

if [[ "$TOOL_NAME" == *apply_migration ]]; then
  echo "BLOCKED: apply_migration refuse. Base en lecture seule pour les agents : une migration passe par un fichier de backend/supabase/migrations/ et le workflow du depot (skill db-migration), jamais par le MCP." >&2
  exit 2
fi

# Analyse lexicale en Python : commentaires, chaînes ('…', E'…', $tag$…$tag$) et
# identifiants entre guillemets retirés avant tout test, pour qu'un mot-clé caché dans
# une chaîne ou un commentaire ne décide ni d'un refus ni d'une autorisation.
# Sortie : rien si toutes les instructions sont des lectures, sinon le motif du refus.
VERDICT=$(python3 -I -c '
import re, sys
sql = sys.stdin.read()
Q, DQ, n = chr(39), chr(34), len(sql)
HI = chr(0x80) + "-" + chr(0x10FFFF)
def ident(ch):
    return (ch.isascii() and ch.isalnum()) or ch in "_$" or ord(ch) > 127
def word_before(k):
    j = k
    while j > 0 and ident(sql[j - 1]): j -= 1
    return sql[j:k]
def stop(reason):
    print(reason); sys.exit(0)
# Délimiteur dollar de PostgreSQL : $$ ou $tag$, tag = lettre, _ ou non ASCII, puis
# lettres, chiffres, _ ou non ASCII (scan.l, dolqdelim).
TAG = re.compile(r"\$(?:[A-Za-z_" + HI + r"][A-Za-z0-9_" + HI + r"]*)?\$")
CONT = re.compile(r"(?:\s|--[^\n]*|/\*.*?\*/)*" + Q, re.S)
stmts, plain, fn = [], [], []
def emit(p, f=None):
    plain.append(p); fn.append(p if f is None else f)
i = 0
while i < n:
    c = sql[i]
    if sql.startswith("--", i):
        j = sql.find("\n", i); i = n if j < 0 else j
        emit(" ")
    elif sql.startswith("/*", i):
        depth, i = 1, i + 2
        while i < n and depth:
            if sql.startswith("/*", i): depth += 1; i += 2
            elif sql.startswith("*/", i): depth -= 1; i += 2
            else: i += 1
        if depth: stop("commentaire non ferme")
        emit(" ")
    elif c == "$" and TAG.match(sql, i):
        # Après un caractère d identifiant, $ prolonge l identifiant (x$a$) ou suit un
        # nombre : lecture incertaine, refus.
        if i > 0 and ident(sql[i - 1]): stop("lexique ambigu : $ colle a un identifiant ou a un nombre")
        tag = TAG.match(sql, i).group(0)
        j = sql.find(tag, i + len(tag))
        if j < 0: stop("chaine dollar non fermee")
        i = j + len(tag); emit(" STR ")
    elif c == Q:
        w = word_before(i)
        # E seul devant la quote = chaîne à échappements ; E collé à un mot = mot puis
        # chaîne standard ; chaîne collée à un nombre (1e...) : lecture selon la version.
        if w[:1].isdigit(): stop("lexique ambigu : chaine collee a un nombre")
        esc = w in ("E", "e")
        i += 1
        while True:
            if i >= n: stop("chaine non fermee")
            if esc and sql[i] == "\\": i += 2; continue
            if sql[i] == Q:
                if i + 1 < n and sql[i + 1] == Q: i += 2; continue
                i += 1; break
            i += 1
        # Deux chaînes séparées par des blancs (avec saut de ligne) n en font qu une, et la
        # suite garde le mode de la première (scan.l, quotecontinue) : E... puis ... se lit
        # avec échappements. Une quote après une chaîne E, derrière blancs ou commentaires
        # seulement, est refusée (lecture fermée, sans usage de lecture légitime connu).
        if esc and CONT.match(sql, i): stop("lexique ambigu : continuation de chaine E")
        emit(" STR ")
    elif c == DQ:
        if sql[max(0, i - 2):i].upper() == "U&": stop("identifiant U& refuse (echappements Unicode)")
        j, name = i + 1, []
        while True:
            if j >= n: stop("identifiant entre guillemets non ferme")
            if sql[j] == DQ:
                if j + 1 < n and sql[j + 1] == DQ: name.append("_"); j += 2; continue
                break
            name.append(sql[j]); j += 1
        i = j + 1
        # Flux des mots-clés : marqueur neutre ; flux des fonctions : nom en clair.
        emit(" QI ", " " + re.sub(r"[^A-Za-z0-9_]", "_", "".join(name)) + " ")
    elif c == ";":
        stmts.append(("".join(plain), "".join(fn))); plain.clear(); fn.clear(); i += 1
    else:
        emit(c); i += 1
stmts.append(("".join(plain), "".join(fn)))
READ_START = ("SELECT", "WITH", "VALUES", "TABLE", "SHOW")
WRITE_WORDS = re.compile(r"\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|INTO|COPY|DROP|ALTER|CREATE|GRANT|REVOKE)\b")
ADMIN_FUNCS = re.compile(r"\b(PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND|PG_RELOAD_CONF|PG_ROTATE_LOGFILE|PG_SWITCH_WAL|PG_CREATE_RESTORE_POINT|PG_LOGICAL_EMIT_MESSAGE|PG_CREATE_LOGICAL_REPLICATION_SLOT|PG_CREATE_PHYSICAL_REPLICATION_SLOT|PG_DROP_REPLICATION_SLOT|PG_FILE_WRITE|SET_CONFIG|SETVAL|NEXTVAL|DBLINK_EXEC|DBLINK|LO_IMPORT|LO_EXPORT|LO_UNLINK|LO_FROM_BYTEA|LO_PUT|PG_NOTIFY|PG_ADVISORY_LOCK|PG_ADVISORY_XACT_LOCK|QUERY_TO_XML|QUERY_TO_XMLSCHEMA|QUERY_TO_XML_AND_XMLSCHEMA|CURSOR_TO_XML|HTTP_POST|HTTP_PUT|HTTP_DELETE|HTTP_PATCH|HTTP_GET|SCHEDULE|UNSCHEDULE|ALTER_JOB)\s*\(")
def classify(p, f):
    s = p.upper().strip()
    if not s: return None
    if s.startswith("EXPLAIN"):
        s = re.sub(r"^EXPLAIN\s*(\([^)]*\))?\s*((ANALYZE|ANALYSE|VERBOSE)\s+)*", "", s)
        if not s: return "EXPLAIN sans instruction"
    head = re.match(r"[A-Z_]*", s.split(None, 1)[0]).group(0)
    if head not in READ_START:
        return "instruction " + (head or "?") + " hors lecture"
    m = WRITE_WORDS.search(s)
    if m: return "mot-cle d ecriture " + m.group(1) + " dans une lecture"
    if re.search(r"\bFOR\s+(NO\s+KEY\s+)?(UPDATE|SHARE|KEY\s+SHARE)\b", s): return "verrou de lignes (FOR UPDATE/SHARE)"
    m = ADMIN_FUNCS.search(f.upper())
    if m: return "fonction a effet de bord " + m.group(1)
    return None
reasons = [r for r in (classify(p, f) for p, f in stmts) if r]
if reasons: print(reasons[0])
' <<<"$QUERY") || {
  echo "BLOCKED: analyse SQL en echec. Garde en echec ferme." >&2
  exit 2
}

if [[ -n "$VERDICT" ]]; then
  echo "BLOCKED: base en lecture seule pour les agents ($VERDICT). Seuls SELECT, WITH sans ecriture, VALUES, TABLE, SHOW et EXPLAIN d'une lecture passent par execute_sql. Schema, index, RLS, fonction ou donnees : fichier de migration + workflow (skill db-migration) ; mutation metier : module ou RPC gouverne." >&2
  exit 2
fi

exit 0
