"""Guard 6 of pretool-bash-guard.sh: does a Bash command start a PROD deploy?

Reads the command on stdin, prints the verdicts found, space separated:
  tag        creates or pushes a v* tag (release-prod.yml trigger: tags v*)
  workflow   runs or re-enables a PROD deploy workflow
  unparsable the command cannot be read as shell words (unclosed quote or here-document)
Empty output = allowed. Called with python3 -I; any crash must be read as a block by the
caller.

A tripwire for agent commands, not the security boundary (GitHub permissions and a v* tag
ruleset are). It reads the words bash would read: quotes, $'...', comments, operators,
redirections (their target is not an argument), arithmetic $((...)), here-documents
(found in the word stream). A word that itself reads as a git/gh command (bash -c '...',
"$(...)", a here-string, a here-document body) is analysed again, whatever its command:
a pipe can hand any of them to a shell. When such a word cannot be read, the commands
complete before the error are still analysed, as bash would run them. A command built from variables or a script file stays
out of reach.
"""
import re
import sys

OPS = set(";&|()`\n")
PROD = r"(release|deploy)[- ]prod|417610500|224452325"
PREFILTER = (re.compile(r"\b(git|gh)\b"), re.compile(r"\b(tag|push|release|api|workflow)\b"))


class Unparsable(ValueError):
    """The text is not valid shell; toks holds the tokens read before the error."""

    def __init__(self, msg, toks):
        super().__init__(msg)
        self.toks = toks


def matching_paren(s, i):
    """Index of the ')' closing the '(' at s[i]."""
    depth = 0
    for j in range(i, len(s)):
        depth += {"(": 1, ")": -1}.get(s[j], 0)
        if depth == 0:
            return j
    raise ValueError("unclosed (")


def lex(s):
    toks = []
    try:
        _lex(s, toks)
    except ValueError as e:
        raise Unparsable(str(e), toks) from e
    return toks


def _lex(s, toks):
    """Shell words ('w', text), operators ('op', c), redirections ('redir', text) and
    here-document bodies ('body', text), appended to toks."""
    word, pending, i, n = None, [], 0, len(s)

    def end():
        nonlocal word
        if word is not None:
            toks.append(("w", word))
            word = None

    while i < n:
        c = s[i]
        if c == "\\":
            if s.startswith("\\\n", i):
                i += 2
                continue
            word = (word or "") + s[i + 1:i + 2]
            i += 2
        elif c == "'":
            j = s.find("'", i + 1)
            if j < 0:
                raise ValueError("unclosed '")
            word = (word or "") + s[i + 1:j]
            i = j + 1
        elif c == "$" and s.startswith("$'", i):
            j, buf = i + 2, ""
            while j < n and s[j] != "'":
                buf += s[j + 1] if s[j] == "\\" and j + 1 < n else s[j]
                j += 2 if s[j] == "\\" else 1
            if j >= n:
                raise ValueError("unclosed $'")
            word = (word or "") + buf
            i = j + 1
        elif s.startswith("$((", i) or (s.startswith("((", i) and word is None):
            # Arithmetic: '<<' is a shift there, not a here-document. The expression is
            # kept as a word (analysed again like any word).
            start = i + 1 if c == "$" else i
            j = matching_paren(s, start)
            word = (word or "") + s[start + 2:j - 1]
            i = j + 1
        elif c == '"':
            j, buf = i + 1, ""
            while j < n and s[j] != '"':
                if s[j] == "\\" and j + 1 < n and s[j + 1] in '"\\$`\n':
                    buf += s[j + 1]
                    j += 2
                else:
                    buf += s[j]
                    j += 1
            if j >= n:
                raise ValueError('unclosed "')
            word = (word or "") + buf
            i = j + 1
        elif c == "#" and word is None:
            while i < n and s[i] != "\n":
                i += 1
        elif c in " \t\r":
            end()
            i += 1
        elif c == "\n":
            end()
            toks.append(("op", "\n"))
            i += 1
            for delim, strip, idx in pending:
                body = []
                while True:
                    if i >= n:
                        raise ValueError("unterminated here-document")
                    j = s.find("\n", i)
                    line, i = (s[i:], n) if j < 0 else (s[i:j], j + 1)
                    if (line.lstrip("\t") if strip else line) == delim:
                        break
                    body.append(line)
                toks[idx] = ("body", "\n".join(body))
            pending = []
        elif s.startswith("<<<", i):
            end()
            toks.append(("redir", "<<<"))
            i += 3
        elif s.startswith("<<", i):
            end()
            strip = s.startswith("<<-", i)
            i += 3 if strip else 2
            while i < n and s[i] in " \t":
                i += 1
            d = ""
            while i < n and s[i] not in " \t\r\n;&|()<>":
                if s[i] in "'\"":
                    k = s.find(s[i], i + 1)
                    if k < 0:
                        raise ValueError("unclosed here-document delimiter")
                    d += s[i + 1:k]
                    i = k + 1
                elif s[i] == "\\":
                    d += s[i + 1:i + 2]
                    i += 2
                else:
                    d += s[i]
                    i += 1
            if not d:
                raise ValueError("empty here-document delimiter")
            toks.append(("body", ""))  # filled when the body is read
            pending.append((d, strip, len(toks) - 1))
        elif c in "<>" or s.startswith("&>", i):
            end()
            j = i + 1
            while j < n and s[j] in "<>&|":
                j += 1
            toks.append(("redir", s[i:j]))
            i = j
        elif c in OPS:
            end()
            toks.append(("op", c))
            i += 1
        else:
            word = (word or "") + c
            i += 1
    if pending:
        raise ValueError("unterminated here-document")
    end()


def commands(toks):
    """Arguments per command, split on operators, and the words that are not arguments:
    redirection targets (a file name, a here-string) and here-document bodies. They are
    analysed again: a here-string or a body may reach a shell, directly (bash <<EOF) or
    through a pipe (cat <<EOF | bash)."""
    out, cur, other, skip = [], [], [], False
    for kind, text in toks:
        if kind == "op":
            out.append(cur)
            cur, skip = [], False
        elif kind == "body":
            other.append(text)
        elif kind == "redir":
            skip = True
        elif skip:
            other.append(text)
            skip = False
        else:
            cur.append(text)
    out.append(cur)
    return [a for a in out if a], other


# git tag: options that take a value (space or attached), and list/query options.
TAG_VALUE = {"-m", "-F", "-u", "--message", "--file", "--local-user", "--cleanup", "--sort",
             "--format", "--trailer", "--contains", "--no-contains", "--merged",
             "--no-merged", "--points-at"}
TAG_LIST = {"-l", "--list", "-v", "--verify", "--contains", "--no-contains", "--merged",
            "--no-merged", "--points-at"}


def git_tag(a):
    listing, names, j = False, [], 0
    while j < len(a):
        t = a[j]
        if t == "--":
            names += a[j + 1:]
            break
        if t.startswith("--"):
            key = t.split("=", 1)[0]
            listing |= key in TAG_LIST
            j += 2 if key in TAG_VALUE and "=" not in t else 1
            continue
        if t.startswith("-") and len(t) > 1:
            for k, ch in enumerate(t[1:], 1):
                if ch in "lvn":  # -n<num> implies --list (git-tag(1))
                    listing = True
                if ch in "mFu":
                    j += 1 if k < len(t) - 1 else 2
                    break
                if ch == "n":  # optional attached number, never a separate word
                    j += 1
                    break
            else:
                j += 1
            continue
        names.append(t)
        j += 1
    return not listing and any(t.startswith("v") or "refs/tags/v" in t for t in names)


def git_push(a):
    if any(t.split("=", 1)[0] in ("--tags", "--follow-tags", "--mirror") for t in a):
        return True
    return any(side.startswith("v") or "refs/tags/" in side
               for t in a if not t.startswith("-")
               for side in t.lstrip("+").split(":"))


def gh_api(a):
    method, fields = None, False
    for j, t in enumerate(a):
        if t in ("-X", "--method") and j + 1 < len(a):
            method = a[j + 1].upper()
        elif t.startswith("--method="):
            method = t.split("=", 1)[1].upper()
        elif t.startswith("-X") and len(t) > 2:
            method = t[2:].upper()
        if t in ("-f", "-F", "--field", "--raw-field", "--input") \
           or re.match(r"-[fF].|--(field|raw-field|input)=", t):
            fields = True
    write = method != "GET" if method else fields
    found = set()
    if write and any(re.search(r"git/(refs|tags)\b|/releases\b", t) for t in a):
        found.add("tag")
    if "graphql" in a and any(re.search(r"create(Ref|Release)|updateRef", t) for t in a):
        found.add("tag")
    if any(re.search(r"actions/workflows/[^/]*(" + PROD + r")[^/]*/(dispatches|enable)\b", t, re.I)
           for t in a):
        found.add("workflow")
    return found


def check(c):
    """Verdicts of one command's arguments."""
    found = set()
    for k, w in enumerate(c):
        base = w.rsplit("/", 1)[-1]
        if base == "git":
            j = k + 1
            while j < len(c) and c[j].startswith("-"):
                j += 2 if c[j] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace") else 1
            if j < len(c) and c[j] == "tag" and git_tag(c[j + 1:]):
                found.add("tag")
            if j < len(c) and c[j] == "push" and git_push(c[j + 1:]):
                found.add("tag")
        elif base == "gh" and k + 1 < len(c):
            a = c[k + 1:]
            if a[0] == "release" and ("create" in a or "edit" in a):
                found.add("tag")
            if a[0] == "workflow" and ("run" in a or "enable" in a) \
               and re.search(PROD, " ".join(a), re.I):
                found.add("workflow")
            if a[0] == "api":
                found |= gh_api(a)
    return found


def analyse(s, depth=0):
    if not all(p.search(s) for p in PREFILTER):
        return set()
    found = set()
    try:
        toks = lex(s)
    except Unparsable as e:
        # Top level: bash would refuse the command, block. Nested (a quoted word, a body):
        # bash runs what precedes the error, so the tokens read so far are still analysed.
        if depth == 0:
            return {"unparsable"}
        toks = e.toks
    cmds, nested = commands(toks)
    for args in cmds:
        found |= check(args)
        nested += args
    if depth < 4:
        for w in nested:
            if w != s:
                found |= analyse(w, depth + 1)
    return found


if __name__ == "__main__":
    try:
        print(" ".join(sorted(analyse(sys.stdin.read()))))
    except Exception:  # noqa: BLE001 - any crash is a block, never a pass
        print("unparsable")
