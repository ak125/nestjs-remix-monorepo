"""Compte les cartes véhicule R1 dans un HTML servi (sans JavaScript).
Carte = <a href> contenant un <h3> et le texte « Voir les pièces » (même critère que le test DS).
Usage : python3 -I cartes-ssr-du13.py fichier.html [...] -> JSON sur stdout."""
import sys, json, gzip, zlib
from html.parser import HTMLParser

class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.stack=[]; s.cards=[]; s.cur=None; s.depth=0; s.imgs=[]
    def handle_starttag(s, tag, attrs):
        a=dict(attrs)
        if tag=='a' and s.cur is None:
            s.cur={'href':a.get('href'),'cls':a.get('class') or '','h3':False,'txt':'','img':None,'tabindex':a.get('tabindex'),'aria_hidden':a.get('aria-hidden'),'inert':'inert' in a}
            s.depth=0
        elif s.cur is not None:
            if tag=='a': s.depth+=1
            if tag=='h3': s.cur['h3']=True
            if tag=='img' and s.cur['img'] is None: s.cur['img']={'src':a.get('src'),'loading':a.get('loading')}
    def handle_endtag(s, tag):
        if tag=='a' and s.cur is not None:
            if s.depth==0:
                c=s.cur; s.cur=None
                if c['h3'] and 'Voir les pièces' in c['txt']:
                    s.cards.append({'href':c['href'],'hidden':'hidden' in c['cls'].split(),'img':c['img'],'tabindex':c['tabindex'],'aria_hidden':c['aria_hidden'],'inert':c['inert']})
            else: s.depth-=1
    def handle_data(s, d):
        if s.cur is not None: s.cur['txt']+=d

out={}
for f in sys.argv[1:]:
    raw=open(f,'rb').read()
    p=P(); p.feed(raw.decode('utf-8'))
    out[f]={'octets':len(raw),'gzip9':len(gzip.compress(raw,9)),'cartes':len(p.cards),
            'avec_href':sum(1 for c in p.cards if c['href']),'visibles':sum(1 for c in p.cards if not c['hidden']),
            'repliees':sum(1 for c in p.cards if c['hidden']),'cartes_detail':p.cards,
            'bouton':('autres compatibilités' in raw.decode('utf-8'))}
print(json.dumps(out,ensure_ascii=False,indent=1))
