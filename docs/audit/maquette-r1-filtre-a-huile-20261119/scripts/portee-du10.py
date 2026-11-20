# Complément n° 10 : tous les liens des conteneurs div.gamme-editorial des 123 pages R1, à la tête mesurée.
# Pour chaque lien : section, conteneur souligné ou non, classe, parent, éléments enfants, texte, seul dans son parent,
# et origine du bloc dans #emplacement (rang du bloc : les blocs non classés suivent ceux de l'emplacement).
# Usage : python3 -I portee-du10.py <base> <sitemap.xml> <out.json>
import json, re, sys, urllib.request, collections
from html.parser import HTMLParser
base, sm, out = sys.argv[1:4]
urls = sorted(set(re.findall(r"/pieces/[a-z0-9-]+-[0-9]+\.html", open(sm).read())))
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"}
class P(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.stack=[]; s.res=[]; s.cur=None
    def ed(s): return [n for n in s.stack if n[0]=="div" and "gamme-editorial" in (n[1].get("class") or "")]
    def handle_starttag(s, t, a):
        a=dict(a)
        if s.cur is not None and t!="a": s.cur["enfants"].append(t)
        if t=="a":
            ed=s.ed()
            if ed:
                sec=next((n[1].get("id") for n in reversed(s.stack) if n[0]=="section" and n[1].get("id")), None)
                par=s.stack[-1]
                s.cur={"section":sec,"conteneurSouligne":"[&_a]:underline" in (ed[-1][1].get("class") or ""),
                       "class":a.get("class"),"href":a.get("href"),"parent":par[0],"classeParent":par[1].get("class"),
                       "enfants":[],"texte":"","_par":par}
                par[2]["liens"]+=1
        if t not in VOID: s.stack.append((t,a,{"txt":"","liens":0}))
    def handle_data(s, d):
        if s.cur is not None: s.cur["texte"]+=d
        elif s.stack: s.stack[-1][2]["txt"]+=d.strip()
    def handle_endtag(s, t):
        if t=="a" and s.cur is not None:
            s.res.append(s.cur); s.cur=None
        for i in range(len(s.stack)-1,-1,-1):
            if s.stack[i][0]==t: del s.stack[i:]; break
R=[]; err=[]
for u in urls:
    try: html=urllib.request.urlopen(base+u, timeout=120).read().decode()
    except Exception as e: err.append((u,str(e))); continue
    p=P(); p.feed(html)
    for l in p.res:
        par=l.pop("_par"); l["seulDansParent"]=(par[2]["txt"]=="" and par[2]["liens"]==1); l["texte"]=" ".join(l["texte"].split()); l["url"]=u; R.append(l)
json.dump({"pages":len(urls),"erreurs":err,"liens":R}, open(out,"w"), ensure_ascii=False, indent=1)
sil=lambda l: bool(l["class"]) and "seo-internal-link" in l["class"]
key=lambda l:(l["section"], l["conteneurSouligne"], "seo-internal-link" if sil(l) else (l["class"] or "sans classe"))
c=collections.Counter(key(l) for l in R)
for k,v in sorted(c.items(), key=lambda x: str(x)): print(k, v, "liens,", len({l["url"] for l in R if key(l)==k}), "pages")
print("pages", len(urls), "erreurs", len(err))
nu=[l for l in R if not l["conteneurSouligne"] and not sil(l)]
print("non soulignés au repos (hors seo-internal-link) :", len(nu), "liens sur", len({l["url"] for l in nu}), "pages")
trois=[l for l in R if l["section"] in ("bien-choisir","qualite-prix","emplacement")]
print("trois blocs : total", len(trois), "dont sans classe", sum(not sil(l) for l in trois), "pages", len({l["url"] for l in trois if not sil(l)}), "| seo-internal-link", sum(sil(l) for l in trois))
print("enfants rencontrés :", collections.Counter(e for l in R for e in l["enfants"]))
print("classes rencontrées :", collections.Counter(l["class"] for l in R))
print("parents (trois blocs, sans classe) :", collections.Counter((l["parent"], l["seulDansParent"]) for l in trois if not sil(l)))
