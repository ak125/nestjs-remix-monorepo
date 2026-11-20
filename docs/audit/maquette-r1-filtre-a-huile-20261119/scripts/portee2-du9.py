# Complément n° 9 : pour chaque lien du conteneur souligné de #reference, texte du parent (li/p) et part du lien dans ce texte.
# Usage : python3 -I portee2-du9.py <base> <c9-portee.json> <out.json>
import json, re, sys, urllib.request
from html.parser import HTMLParser
base, src, out = sys.argv[1:4]
pages = sorted({x["url"] for x in json.load(open(src)) if any(l["souligneParDS"] for l in x.get("liens", []))})
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"}
class P(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.stack=[]; s.res=[]
    def handle_starttag(s, t, a):
        a=dict(a); und=any(n["t"]=="div" and "[&_a]:underline" in (n["a"].get("class") or "") for n in s.stack)
        node={"t":t,"a":a,"txt":"","und":und}
        if t=="a" and und:
            par=s.stack[-1]; node["par"]=par; s.res.append(node)
        if t not in VOID: s.stack.append(node)
    def handle_endtag(s, t):
        for i in range(len(s.stack)-1,-1,-1):
            if s.stack[i]["t"]==t: del s.stack[i:]; break
    def handle_data(s, d):
        for n in s.stack: n["txt"]+=d
R=[]
for u in pages:
    html=urllib.request.urlopen(base+u, timeout=90).read().decode()
    p=P(); p.feed(html)
    for n in p.res:
        lt=re.sub(r"\s+"," ",n["txt"]).strip(); pt=re.sub(r"\s+"," ",n["par"]["txt"]).strip()
        R.append({"url":u,"href":n["a"].get("href"),"class":n["a"].get("class"),"parent":n["par"]["t"],"lien":lt,"texteParent":pt[:220],"lienSeulDansParent":lt.rstrip(" .")==pt.rstrip(" .")})
json.dump(R, open(out,"w"), ensure_ascii=False, indent=1)
import collections
print(len(R), collections.Counter((r["parent"], r["lienSeulDansParent"], r["class"]) for r in R))
for r in R:
    if r["lienSeulDansParent"] or len(r["texteParent"])-len(r["lien"])<25: print(r["url"], r["parent"], r["class"], "|", r["texteParent"][:160])
