# c12-portee.py — recensement des lignes de fabrication des cartes véhicule R1 à la tête de #2210.
# API : toutes les cartes (règle de r1FabricationYears appliquée aux années reçues).
# HTML servi : cartes réellement rendues côté serveur (les 12 visibles par page).
import json,glob,os,re,collections,html
def find(o):
  if isinstance(o,dict):
    if 'motorisations' in o and isinstance(o['motorisations'],dict) and 'items' in o['motorisations']: return o['motorisations']
    for v in o.values():
      r=find(v)
      if r is not None: return r
def fab(f,t):
  s=(f or '').strip(); e=(t or '').strip()
  if s and e: return 'Fabrication', (s if s==e else f"{s}–{e}")
  if s: return 'Début de fabrication', s
  if e: return 'Fin de fabrication', e
  return None, None
api=collections.Counter(); pages=0; sans=0; cartes=0; pages_debut=set(); attendu={}
for f in glob.glob('c12-api/*.json'):
  m=find(json.load(open(f)))
  if not m or not m.get('items'): sans+=1; continue
  pages+=1; its=m['items']; cartes+=len(its)
  slug=its[0]['link'].split('/')[2]; exp=[]
  for i,it in enumerate(its):
    l,a=fab(it.get('type_year_from'),it.get('type_year_to')); key=l or 'aucune'
    if l=='Fabrication' and '–' not in a: key='Fabrication (une année)'
    api[key]+=1
    if l=='Début de fabrication': pages_debut.add(slug)
    if i<12 and l: exp.append(f"{l} : {a}")
  attendu[slug]=exp
print(f"API : pages avec cartes {pages}, sans cartes {sans}, cartes {cartes}")
print("API : lignes par cas", dict(api), "; pages avec au moins un « Début de fabrication » :", len(pages_debut))
ssr=collections.Counter(); des=0; ecarts=0; total=0
for f in glob.glob('c12-ssr/*.html'):
  slug=os.path.basename(f)[:-5]; s=open(f).read()
  des+=len(re.findall(r'>\s*dès\s', s)) + len(re.findall(r'\bdès 2\d{3}|\bdès 1\d{3}', s))
  lignes=[html.unescape(re.sub(r'<[^>]+>','',m)).replace('&nbsp;',' ') for m in re.findall(r'<p class="text-sm text-gray-600 mb-4 font-medium">(.*?)</p>', s)]
  lignes=[re.sub(r'\s+',' ',l.replace(' ',' ')).strip() for l in lignes]
  exp=[re.sub(r'\s+',' ',x.replace(' ',' ')) for x in attendu[slug]]
  total+=len(lignes)
  if lignes!=exp: ecarts+=1; print("ÉCART", slug, lignes[:3], exp[:3])
  for l in lignes: ssr[l.split(' :')[0]]+=1
print(f"HTML servi : {len(glob.glob('c12-ssr/*.html'))} pages, {total} lignes rendues, par libellé {dict(ssr)}")
print(f"HTML servi : occurrences de « dès AAAA » : {des} ; pages dont les lignes diffèrent de l'attendu : {ecarts}")
