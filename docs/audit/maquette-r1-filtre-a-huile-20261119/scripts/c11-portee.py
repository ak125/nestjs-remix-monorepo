import json,sys,glob,collections,os
def find(o):
  if isinstance(o,dict):
    if 'motorisations' in o and isinstance(o['motorisations'],dict) and 'items' in o['motorisations']: return o['motorisations']
    for v in o.values():
      r=find(v)
      if r is not None: return r
def fab(f,t):
  s=(f or '').strip(); e=(t or '').strip()
  if s and e: return ('plage' if s!=e else 'annee'), (s if s==e else f"{s}–{e}")
  if s: return 'des', f"dès {s}"
  if e: return 'jusqu', f"jusqu'en {e}"
  return 'aucune', None
cas=collections.Counter(); types=collections.Counter(); pages=0; cartes=0; erreurs=[]; sans=0
dup_pages=0; dup_cartes=0; dup_visibles=0; exemples=collections.defaultdict(list); ids_des=set()
for f in sorted(glob.glob('c11-api/*.json'), key=lambda p:int(os.path.basename(p)[:-5])):
  pg=os.path.basename(f)[:-5]
  try: d=json.load(open(f))
  except Exception as e: erreurs.append((pg,'json')); continue
  m=find(d)
  if not m or not m.get('items'): sans+=1; continue
  pages+=1; its=m['items']; cartes+=len(its)
  c=collections.Counter()
  for i in its:
    for k in ('type_year_from','type_year_to'): types[type(i.get(k)).__name__]+=1
    k,l=fab(i.get('type_year_from'),i.get('type_year_to')); cas[k]+=1; c[l]+=1
    if k in('des','jusqu','aucune','annee') and len(exemples[k])<6: exemples[k].append((pg,i['cgc_type_id'],i['marque_name'],i['modele_name'],i['type_name'],l))
    if k=='des': ids_des.add(str(i['cgc_type_id']))
  d2=sum(v for l,v in c.items() if v>1 and l)
  if d2: dup_pages+=1; dup_cartes+=d2
  vis=collections.Counter(fab(i.get('type_year_from'),i.get('type_year_to'))[1] for i in its[:12])
  dup_visibles+=sum(v for l,v in vis.items() if v>1 and l)
print(f"pages avec cartes {pages}, sans cartes {sans}, erreurs {erreurs}")
print(f"cartes {cartes} ; cas {dict(cas)} ; types des champs {dict(types)}")
print(f"lignes « Fabrication » partagées par 2+ cartes d'une même page : {dup_cartes} cartes sur {dup_pages} pages ; parmi les 12 visibles : {dup_visibles}")
for k,v in exemples.items(): print(k, v)
open('c11-ids-des.txt','w').write(",".join(sorted(ids_des,key=int)))
print("type_id distincts en 'dès' :", len(ids_des))
