# Complément n° 14 au mandat DU : structure SSR d'une page R8 (sans JavaScript).
# Usage : python3 -I ssr-r8-du14.py page.html sortie.json
import sys, re, json, gzip, html as H
from html.parser import HTMLParser
src = open(sys.argv[1], encoding="utf-8").read()
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.stack=[]; s.out=[]; s.sec=None; s.secs=[]; s.links=[]; s.cur_a=None; s.h=None; s.heads=[]; s.text=[]; s.skip=0; s.main=False
    def handle_starttag(s,t,a):
        a=dict(a)
        if t in("script","style","noscript"): s.skip+=1
        ds=a.get("data-section")
        if ds: s.secs.append(ds); s.sec=ds
        if t=="a": s.cur_a={"href":a.get("href"),"sec":s.sec,"txt":"","rel":a.get("rel")}
        if re.fullmatch(r"h[1-6]",t): s.h={"tag":t,"sec":s.sec,"txt":""}
    def handle_endtag(s,t):
        if t in("script","style","noscript"): s.skip-=1
        if t=="a" and s.cur_a: s.cur_a["txt"]=" ".join(s.cur_a["txt"].split())[:80]; s.links.append(s.cur_a); s.cur_a=None
        if s.h and t==s.h["tag"]: s.h["txt"]=" ".join(s.h["txt"].split())[:90]; s.heads.append(s.h); s.h=None
    def handle_data(s,d):
        if s.skip: return
        if s.cur_a is not None: s.cur_a["txt"]+=d
        if s.h is not None: s.h["txt"]+=d
        if d.strip(): s.text.append((s.sec,d.strip()))
p=P(); p.feed(src)
def role(h):
    if not h: return "vide"
    if h.startswith("#"): return "ancre"
    if h.startswith("http") and "automecanik" not in h: return "externe"
    h=re.sub(r"^https?://[^/]+","",h)
    if re.match(r"^/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$",h): return "R2"
    if re.match(r"^/pieces/[^/]+\.html$",h): return "R1"
    if re.match(r"^/constructeurs/[^/]+\.html$",h): return "R7"
    if re.match(r"^/constructeurs/[^/]+/[^/]+/[^/]+\.html$",h): return "R8"
    if h.startswith("/blog-pieces-auto/conseils/"): return "R3"
    if h.startswith("/diagnostic") or "/diagnostic-auto" in h: return "R5"
    return "autre"
from collections import Counter, OrderedDict
secs=list(OrderedDict.fromkeys(p.secs))
words=Counter(); 
for sec,t in p.text: words[sec]+=len(t.split())
res={"octets":len(src.encode()),"gzip9":len(gzip.compress(src.encode(),9)),
 "title":(re.search(r"<title>([^<]*)",src) or [None,None])[1],
 "robots":re.findall(r'<meta name="robots" content="([^"]*)"',src),
 "canonical":re.findall(r'<link rel="canonical" href="([^"]*)"',src),
 "description":re.findall(r'<meta name="description" content="([^"]*)"',src),
 "jsonld_types":re.findall(r'"@type":"([A-Za-z]+)"',src)[:20],
 "sections":secs,
 "titres":[(h["tag"],h["sec"],H.unescape(h["txt"])) for h in p.heads],
 "mots_par_section":dict(words),"mots_total":sum(words.values()),
 "liens_par_role":dict(Counter(role(l["href"]) for l in p.links)),
 "liens_par_section_role":{f'{l_sec}|{r}':n for (l_sec,r),n in Counter((l["sec"],role(l["href"])) for l in p.links).items()},
 "R2_uniques":sorted({re.sub(r"^https?://[^/]+","",l["href"]) for l in p.links if role(l["href"])=="R2"}),
 "liens":[{"href":l["href"],"sec":l["sec"],"role":role(l["href"]),"txt":H.unescape(l["txt"])} for l in p.links],
 "emplacements":re.findall(r"Emplacement maquette[^<]{0,0}",src).__len__(),
 "termes_interdits":{t:len(re.findall(t,re.sub(r"<script\b[^>]*>.*?</script[^>]*>","",src,flags=re.S|re.I),re.I)) for t in ["démontage","remontage","étapes de remplacement","couple de serrage","définition","qu'est-ce que","composé de","glossaire","prix","panier","en stock","livraison"]},
}
json.dump(res,open(sys.argv[2],"w"),ensure_ascii=False,indent=1)
print("octets",res["octets"],"gzip",res["gzip9"],"mots",res["mots_total"])
print("sections",secs)
for t in res["titres"]: print(" ",t)
print("liens",res["liens_par_role"],"R2 uniques",len(res["R2_uniques"]))
print("interdits",{k:v for k,v in res["termes_interdits"].items() if v})
