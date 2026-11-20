# Complément n° 9 : liens de tous les conteneurs div.gamme-editorial des pages R1, par section,
# et si le conteneur porte [&_a]:underline. seo-internal-link = déjà souligné par sa propre règle.
# Usage : python3 -I portee3-du9.py <base> <sitemap.xml> <out.json>
import json, re, sys, urllib.request, collections
from html.parser import HTMLParser
base, sm, out = sys.argv[1:4]
urls = sorted(set(re.findall(r"/pieces/[a-z0-9-]+-[0-9]+\.html", open(sm).read())))
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"}
class P(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.stack=[]; s.res=[]
    def handle_starttag(s, t, a):
        a=dict(a)
        if t=="a":
            ed=[n for n in s.stack if n[0]=="div" and "gamme-editorial" in (n[1].get("class") or "")]
            if ed:
                sec=next((n[1].get("id") for n in reversed(s.stack) if n[0]=="section" and n[1].get("id")), None)
                s.res.append({"section":sec,"conteneurSouligne":"[&_a]:underline" in (ed[-1][1].get("class") or ""),"class":a.get("class"),"href":a.get("href")})
        if t not in VOID: s.stack.append((t,a))
    def handle_endtag(s, t):
        for i in range(len(s.stack)-1,-1,-1):
            if s.stack[i][0]==t: del s.stack[i:]; break
R=[]; err=[]
for u in urls:
    try: html=urllib.request.urlopen(base+u, timeout=120).read().decode()
    except Exception as e: err.append((u,str(e))); continue
    p=P(); p.feed(html)
    for l in p.res: l["url"]=u; R.append(l)
json.dump({"pages":len(urls),"erreurs":err,"liens":R}, open(out,"w"), ensure_ascii=False, indent=1)
key=lambda l:(l["section"], l["conteneurSouligne"], "seo-internal-link" if l["class"] and "seo-internal-link" in l["class"] else (l["class"] or "sans classe"))
c=collections.Counter(key(l) for l in R)
for k,v in sorted(c.items(), key=lambda x: str(x)): print(k, v, "liens,", len({l["url"] for l in R if key(l)==k}), "pages")
nu=[l for l in R if not l["conteneurSouligne"] and not (l["class"] and "seo-internal-link" in l["class"])]
print("pages", len(urls), "erreurs", len(err))
print("non soulignés au repos (hors seo-internal-link) :", len(nu), "liens sur", len({l["url"] for l in nu}), "pages")
