#!/usr/bin/env python3
"""Mandat DZ, point 9 : recalcul indépendant (Python, bibliothèque standard seule) du contraste des cas
capturés par verif-manuelle-dz.cjs. Décode les PNG, prend le fond = couleur la plus fréquente de la capture
« fond » (texte masqué), le texte = couleur la plus fréquente parmi les pixels de la capture « texte »
à au moins 60 % de l'écart maximal au fond (cœur des glyphes, hors anticrénelage), puis applique la formule WCAG 2.x.
Usage : python3 -I verif-manuelle-dz.py <dossier-livrable>
"""
import json, os, struct, sys, zlib
from collections import Counter

def png_pixels(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, idat, w = 8, b"", None
    while pos < len(data):
        ln, typ = struct.unpack(">I4s", data[pos:pos + 8]); body = data[pos + 8:pos + 8 + ln]; pos += 12 + ln
        if typ == b"IHDR": w, h, depth, ctype = struct.unpack(">IIBB", body[:10]); assert depth == 8
        elif typ == b"IDAT": idat += body
    bpp = {2: 3, 6: 4}[ctype]; raw = zlib.decompress(idat); stride = w * bpp; rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[i]; line = bytearray(raw[i + 1:i + 1 + stride]); i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0; b = prev[x]; c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line); prev = line
    return [tuple(r[x:x + 3]) for r in rows for x in range(0, stride, bpp)]

def lin(v):
    v /= 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

def L(c): return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
def ratio(a, b):
    x, y = L(a), L(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)
def hx(c): return "#%02x%02x%02x" % tuple(round(v) for v in c)

root = sys.argv[1] if len(sys.argv) > 1 else "."
src = json.load(open(os.path.join(root, "mesures", "verif-manuelle-captures.json")))
out = []
for c in src["cas"]:
    if c.get("erreur"): out.append({"n": c["n"], "erreur": c["erreur"]}); continue
    fond = png_pixels(os.path.join(root, c["capturesFond"])); texte = png_pixels(os.path.join(root, c["capturesTexte"]))
    bg = Counter(fond).most_common(1)[0][0]
    d = lambda p: sum(abs(p[k] - bg[k]) for k in range(3))
    dmax = max(d(p) for p in texte)
    # couleur la plus fréquente parmi les pixels nettement éloignés du fond (cœur des glyphes) :
    # un texte uni a ses pixels pleins exactement à sa couleur ; un point parasite isolé ne l'emporte pas
    fg = Counter(p for p in texte if d(p) >= 0.6 * dmax).most_common(1)[0][0]
    out.append({"n": c["n"], "nature": c["nature"], "page": c["page"], "viewport": f'{c["w"]}x{c["h"]}', "texte": c["css"]["texte"],
                "couleurCss": c["css"]["color"], "taille": c["css"]["fontSize"], "graisse": c["css"]["fontWeight"],
                "fondPeint": hx(bg), "partFond": round(Counter(fond).most_common(1)[0][1] / len(fond), 2),
                "textePeint": hx(fg), "ratioRecalcule": round(ratio(fg, bg), 2), "capture": c["capturesTexte"], "at": c["at"]})
json.dump({"methode": __doc__.strip(), "cas": out}, open(os.path.join(root, "mesures", "verif-manuelle.json"), "w"), ensure_ascii=False, indent=1)
for o in out: print(json.dumps(o, ensure_ascii=False))
