import json,sys,collections
def find(o):
  if isinstance(o,dict):
    if 'motorisations' in o and isinstance(o['motorisations'],dict) and 'items' in o['motorisations']: return o['motorisations']
    for v in o.values():
      r=find(v)
      if r: return r
def fab(f,t):
  s=(f or '').strip(); e=(t or '').strip()
  if s and e: return s if s==e else f"{s}–{e}"
  if s: return f"dès {s}"
  if e: return f"jusqu'en {e}"
  return None
for pg in sys.argv[1:]:
  its=find(json.load(open(f"{pg}")))['items']
  print(f"== {pg} : {len(its)} cartes")
  lignes=collections.Counter()
  for n,i in enumerate(its,1):
    l=fab(i.get('type_year_from'),i.get('type_year_to'))
    cle=(i['marque_name'],i['modele_name'],i['type_name'],i['puissance'],l)
    lignes[cle]+=1
    print(n, i['cgc_type_id'], type(i.get('type_year_from')).__name__, i['marque_name'], i['modele_name'], i['type_name'], i['puissance'], '->', l, '| moteur', i.get('engine_code'))
  print("cartes au contenu identique (marque, modèle, version, puissance, ligne):", {k:v for k,v in lignes.items() if v>1})
  print("ids:", ",".join(str(i['cgc_type_id']) for i in its))
