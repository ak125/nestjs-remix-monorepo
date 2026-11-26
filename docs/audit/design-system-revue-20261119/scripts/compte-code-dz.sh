#!/usr/bin/env bash
# Mandat DZ — 6.8 : comptes « déduits du code » pour les affirmations du point 3 (aucune mesure rendue).
# Périmètre : frontend/app, fichiers .ts et .tsx (sauf mention), au HEAD du worktree.
# Usage (depuis la racine du worktree) : bash docs/audit/design-system-revue-20261119/scripts/compte-code-dz.sh
set -u
F=frontend/app
c() { rg -o "$1" $F --glob '*.{tsx,ts}' | wc -l; }
f() { rg -l "$1" $F --glob '*.{tsx,ts}' | wc -l; }
echo "HEAD $(git rev-parse HEAD)  $(date -u +%FT%TZ)"
echo "text-gray-400 : $(c '\btext-gray-400\b') occurrences / $(f '\btext-gray-400\b') fichiers ; tout préfixe gray-400 : $(c '\bgray-400\b')"
echo "text-slate-400 : $(c '\btext-slate-400\b')"
echo "focus:ring-blue-500 : $(c 'focus:ring-blue-500') / $(f 'focus:ring-blue-500') fichiers"
echo "font-extrabold : $(c '\bfont-extrabold\b') ; font-black : $(c '\bfont-black\b')"
echo "text-cta : $(c '\btext-cta\b') ; text-orange-500 : $(c '\btext-orange-500\b') ; text-orange-600 : $(c '\btext-orange-600\b')"
echo "variant= yellow $(c 'variant="yellow"') green $(c 'variant="green"') orange $(c 'variant="orange"') destructive $(c 'variant="destructive"')"
echo "behavior: \"smooth\" : $(c 'behavior: "smooth"') / $(f 'behavior: "smooth"') fichiers"
echo "--- @font-face (plages de graisse déclarées) dans $F/global.css"
rg -n "font-family|font-weight" $F/global.css | sed -n 1,12p
echo "--- scroll-behavior en CSS (frontend/app, design-tokens/src, tailwind config)"
rg -n "scroll-behavior" $F packages/design-tokens/src --glob '*.{css,ts,tsx,js}' frontend/tailwind.config.* 2>/dev/null | sed -n 1,10p
echo "--- activation d'un thème sombre (classList 'dark', setTheme, data-theme) hors utilitaires dark:"
rg -n "classList\.(add|toggle)\(['\"]dark|setTheme\(|data-theme" $F --glob '*.{ts,tsx}' | sed -n 1,10p
echo "--- <img> sans width ET height ni aspect- dans la balise (heuristique, .tsx seuls, spread {...} exclu)"
python3 -I - <<'EOF'
import re, glob
tot = nod = 0; files = set()
for f in glob.glob('frontend/app/**/*.tsx', recursive=True):
    s = open(f, encoding='utf8').read()
    for m in re.finditer(r'<img\b', s):
        i, d = m.end(), 0
        while i < len(s):
            ch = s[i]
            if ch == '{': d += 1
            elif ch == '}': d -= 1
            elif ch == '>' and d == 0: break
            i += 1
        tag = s[m.start():i]; tot += 1
        if not (re.search(r'\bwidth[=:]', tag) and re.search(r'\bheight[=:]', tag)) and 'aspect-' not in tag and '{...' not in tag:
            nod += 1; files.add(f)
print(f"balises <img> : {tot} ; sans dimensions : {nod} ; fichiers : {len(files)}")
EOF
