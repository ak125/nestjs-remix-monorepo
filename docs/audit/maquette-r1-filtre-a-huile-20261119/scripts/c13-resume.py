import json,sys
d=json.load(open(sys.argv[1]))
for k in ('avant','apresEntree','apresEspace'):
  v=d.get(k); print(k, v and {x:v[x] for x in v if x not in ('hrefs','imgMasquees','imgVisibles')})
for k in ('http','imagesMasqueesAvantClic','imagesMasqueesApresClic','requetesImagesAvantClic','cls','lcp','tab','boutonFocalise','focusApresEntree','shiftTabApresEntree'): print(k,d.get(k))
print({k:v for k,v in d.get('ariaSection',{}).items() if 'Liens' in k})
