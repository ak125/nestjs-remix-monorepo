# Complément n° 9 au mandat DU : portée du soulignement [&_a]:underline du conteneur éditorial de #reference.
# Parcourt les URL R1 du sitemap des catégories sur un rendu local, et relève pour chaque page :
#  - les liens du conteneur div.gamme-editorial portant [&_a]:underline dans #reference (classes, parent, contenu) ;
#  - les liens de la section #emplacement.
# Usage : python3 -I portee-du9.py <base> <sitemap.xml> <out.json>
import json, re, sys, time, urllib.request
from html.parser import HTMLParser
base, sm, out = sys.argv[1:4]
urls = sorted(set(re.findall(r"/pieces/[a-z0-9-]+-[0-9]+\.html", open(sm).read())))
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"}
class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.stack=[]; s.links=[]; s.cur=None
    def handle_starttag(s, t, a):
        a=dict(a)
        ctx=None
        for (tt,aa) in reversed(s.stack):
            if tt=="section" and aa.get("id") in ("reference","emplacement"): ctx=aa.get("id"); break
        und=any(tt=="div" and "[&_a]:underline" in (aa.get("class") or "") for tt,aa in s.stack)
        if t=="a":
            s.cur={"section":ctx,"souligneParDS":und,"href":a.get("href"),"class":a.get("class"),"parent":(s.stack[-1][0]+"."+(s.stack[-1][1].get("class") or "")[:40]) if s.stack else None,"texte":"","enfants":[]}
            s.links.append(s.cur)
        elif s.cur is not None: s.cur["enfants"].append(t)
        if t not in VOID: s.stack.append((t,a))
    def handle_endtag(s, t):
        if t=="a": s.cur=None
        for i in range(len(s.stack)-1,-1,-1):
            if s.stack[i][0]==t: del s.stack[i:]; break
    def handle_data(s, d):
        if s.cur is not None: s.cur["texte"]+=d
res=[]
for u in urls:
    t0=time.time()
    try:
        with urllib.request.urlopen(base+u, timeout=90) as r: code=r.status; html=r.read().decode("utf-8","replace")
    except Exception as e:
        res.append({"url":u,"erreur":str(e)}); continue
    p=P(); p.feed(html)
    L=[dict(l, texte=re.sub(r"\s+"," ",l["texte"]).strip()) for l in p.links if l["section"] in ("reference","emplacement")]
    res.append({"url":u,"code":code,"conteneurSouligne":"[&amp;_a]:underline" in html,"liens":L,"s":round(time.time()-t0,2)})
    time.sleep(0.2)
json.dump(res, open(out,"w"), ensure_ascii=False, indent=1)
print(len(res), "pages")
