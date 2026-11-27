# Annexe — requêtes et commandes du mandat CQ

Toutes les requêtes ont été lancées le 18/11/2026, entre 18:20 et 18:38 UTC.
Elles passent par `sweep-psql.sh`, copié depuis
`910b1e9f04:.claude/skills/live-evidence-sweep/scripts/sweep-psql.sh`, qui
ouvre une transaction `read only` avec `statement_timeout` à 60 s. La sortie a
été filtrée par `grep -v -E "WARNING|DETAIL|HINT|^SET"`. Aucune requête ne lit
de donnée client ni de secret.

## A. Sitemap public et Search Console

Fichiers sitemap (GET PROD, 18:21:36Z → 18:21:52Z) :
`/sitemap.xml`, puis chaque `<loc>` de l'index ; comptage des `<loc>` par
fichier.

```sql
-- GSC par page /pieces/ (lu à 18:22:02Z) ; fenêtre 28 j = 2026-10-19 → 2026-11-15
select page,
  sum(clicks) filter (where date between '2026-10-19' and '2026-11-15') c28,
  sum(impressions) filter (where date between '2026-10-19' and '2026-11-15') i28,
  sum(clicks) filter (where date between '2026-07-01' and '2026-07-31') cjul,
  sum(clicks) filter (where date between '2026-10-01' and '2026-10-31') coct,
  sum(clicks) filter (where date >= '2026-08-18') c90
from __seo_gsc_daily_page_totals where page ~ '/pieces/' group by page;
```

Pages perdues (recoupement AK) : URL normalisées par
`sub(/^https?:\/\/[^\/]+/,"")`, puis `cjul>0 et coct=0` → 1 269, dont 1 258 R2.

## B. Décision 48 par couple gamme × type (18:23 → 18:25Z)

Générateur de requête par lot de 10 000 couples (`mksql.py`) :

```python
import sys
d,start,n=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
rows=[l.split() for l in open(f'{d}/pairs.tsv')][start:start+n]
vals=",".join(f"({a},{b})" for a,b in rows)
print(f"""copy (with p(pg,t) as (values {vals})
select pg,t,
 exists(select 1 from pieces_relation_type r where r.rtp_pg_id=p.pg and r.rtp_type_id=p.t) any_rel,
 exists(select 1 from pieces_relation_type r join pieces_price pp on pp.pri_piece_id_i=r.rtp_piece_id join pieces pc on pc.piece_id=r.rtp_piece_id
   where r.rtp_pg_id=p.pg and r.rtp_type_id=p.t and pp.pri_dispo in ('1','2','3') and coalesce(pp.pricing_state,'')<>'FROZEN' and pc.piece_display and pp.pri_vente_ttc_n>0) vend123,
 exists(select 1 from pieces_relation_type r join pieces_price pp on pp.pri_piece_id_i=r.rtp_piece_id join pieces pc on pc.piece_id=r.rtp_piece_id
   where r.rtp_pg_id=p.pg and r.rtp_type_id=p.t and pp.pri_dispo='1' and coalesce(pp.pricing_state,'')<>'FROZEN' and pc.piece_display and pp.pri_vente_ttc_n>0) vend1
from p) to stdout with (format csv, delimiter E'\\t');""")
```

Agrégation (`d48.py`) :

```python
import re,sys,collections,json
d='.'
R2=re.compile(r'^/pieces/[^/]+-(\d+)/[^/]+-(\d+)/[^/]+-(\d+)/[^/]+-(\d+)\.html$')
def norm(u): return re.sub(r'^https?://[^/]+','',u).split('?')[0]
st={}
for l in open('d48_pairs.tsv'):
    p=l.rstrip('\n').split('\t')
    if len(p)<5: continue
    st[(p[0],p[1])]=(p[2]=='t',p[3]=='t',p[4]=='t')
sm=set(l.strip() for l in open('sm/sm_r2.txt'))
g=collections.defaultdict(lambda:[0,0,0,0,0])
for l in open('sm/gsc_pieces.tsv'):
    p=l.rstrip('\n').split('\t')
    if len(p)<6: continue
    u=norm(p[0])
    if not R2.match(u): continue
    for i,v in enumerate(p[1:6]): g[u][i]+=int(v or 0)
def key(u):
    m=R2.match(u); return (m.group(1),m.group(4))
out={}
# sitemap
smst=collections.Counter()
for u in sm: smst[st.get(key(u))]+=1
out['sitemap_by_state(any,vend123,vend1)']={str(k):v for k,v in smst.items()}
seen=[u for u,v in g.items() if v[1]>0]
c=collections.Counter(); clicks=collections.Counter(); pages_clicked=collections.Counter()
for u in seen:
    s=st.get(key(u)); insm=u in sm
    k=(insm, s[1] if s else None)
    c[k]+=1; clicks[k]+=g[u][0]; pages_clicked[k]+= (g[u][0]>0)
out['seen28 by (in_sitemap, vend123)']={str(k):[c[k],pages_clicked[k],clicks[k]] for k in c}
# exits: in sitemap & not vendable ; entries: seen28 not in sitemap & vendable
exits=[u for u in sm if not st[key(u)][1]]
out['exits_n']=len(exits); out['exits_clicked28']=sum(1 for u in exits if g.get(u,[0])[0]>0); out['exits_clicks28']=sum(g[u][0] for u in exits if u in g)
out['sitemap_clicked28_total']=sum(1 for u in sm if g.get(u,[0])[0]>0)
ent=[u for u in seen if u not in sm and st[key(u)][1]]
out['entries_from_seen28_n']=len(ent); out['entries_clicks28']=sum(g[u][0] for u in ent)
# clicked R2 pages (28d) that are not vendable -> would be noindex under d48
nv=[u for u in seen if g[u][0]>0 and not st[key(u)][1]]
out['clicked28_not_vendable_pages']=len(nv); out['clicked28_not_vendable_clicks']=sum(g[u][0] for u in nv)
out['clicked28_total_pages']=sum(1 for u in seen if g[u][0]>0)
# vend1 only variant
nv1=[u for u in seen if g[u][0]>0 and not st[key(u)][2]]
out['clicked28_not_vend1_pages']=len(nv1)
out['seen28_no_relation']=sum(1 for u in seen if not st[key(u)][0])
json.dump(out,sys.stdout,indent=1)
```

Gammes vendables, par tranches de `pri_piece_id_i` d'un million (index
`idx_pieces_price_piece_id_i`, environ 1 s par tranche) :

```sql
select pc.piece_pg_id, count(*) from pieces_price pp join pieces pc on pc.piece_id=pp.pri_piece_id_i
where pp.pri_dispo in ('1','2','3') and coalesce(pp.pricing_state,'')<>'FROZEN'
  and pp.pri_vente_ttc_n>0 and pc.piece_display and pp.pri_piece_id_i between $lo and $hi group by 1;
```

## C. `__sitemap_p_link`, `pieces_gamme`, `auto_type`

```sql
select n_live_tup, n_tup_ins, n_tup_upd, n_tup_del from pg_stat_user_tables where relname='__sitemap_p_link';
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where pg_get_functiondef(p.oid) ilike '%__sitemap_p_link%' and n.nspname not in ('pg_catalog','information_schema') and p.prokind='f';
select tgname from pg_trigger where tgrelid='public.__sitemap_p_link'::regclass and not tgisinternal;
select jobid, schedule from cron.job where command ilike '%sitemap%';
select count(*), count(*) filter (where a.type_id is null) absent from __sitemap_p_link s left join auto_type a on a.type_id::text=s.map_type_id::text;
select count(*) filter (where a.type_id is null) absent_gt20 from __sitemap_p_link s left join auto_type a on a.type_id::text=s.map_type_id::text where s.map_has_item>20;
select count(*) filter (where pg_display='1'), count(*) filter (where pg_display='1' and pg_relfollow='1'),
  count(*) filter (where pg_display='1' and pg_relfollow='1' and pg_level='1'),
  count(*) filter (where pg_display='1' and pg_level in ('1','2')), count(*) filter (where pg_level='1'), count(*) from pieces_gamme;
select proname from pg_proc where proname ilike '%vendable%' or proname ilike '%sellable%';
```

## D. Crawl synthétique

```sql
select distinct on (url) regexp_replace(url,'^https?://[^/]+',''), http_code, coalesce(robots_meta,''), coalesce(x_robots_tag,'')
from __seo_snapshot_synthetic where created_at >= '2026-11-11' and created_at < '2026-11-18'
  and url ~ '/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' order by url, created_at desc;
```

## E. R1 au niveau requête

```sql
with d as (select page, query, sum(clicks) c, sum(impressions) i,
  (sum(position*impressions)/nullif(sum(impressions),0))::numeric pos
  from __seo_gsc_daily where date between '2026-10-19' and '2026-11-15' group by 1,2),
k as (select *, case when page ~ '/pieces/[^/]+-[0-9]+\.html$' then 'R1'
  when page ~ '/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' then 'R2'
  when page ~ '/blog-pieces-auto/conseils/' then 'conseils' when page ~ '/blog-pieces-auto/' then 'blog'
  when page ~ '/constructeurs/' then 'constructeurs' else 'autre' end kind from d)
select kind, count(distinct page), count(distinct query), sum(c), sum(i), round(sum(pos*i)/sum(i),1) from k group by 1 order by 5 desc;
```

La comparaison à périmètre égal joint les couples (page, requête) de la période
du 1er au 15 juillet avec ceux du 1er au 15 novembre. Elle compte les couples
communs, nouveaux et perdus, avec leur position pondérée par les impressions.

## F. Liens sans identifiant dans les contenus (18:37:27Z)

```sql
with l as (select sg.sg_pg_id::text pg, m[1] href from __seo_gamme sg,
  regexp_matches(sg.sg_content, 'href="(/pieces/[a-z0-9-]+(?:\.html)?)"', 'g') m)
select l.pg, g.pg_alias, g.pg_level, g.pg_relfollow, count(*) n, string_agg(distinct l.href, ' ')
from l join pieces_gamme g on g.pg_id::text=l.pg where l.href !~ '-[0-9]+(\.html)?$' group by 1,2,3,4;
select count(*), sum((select count(*) from regexp_matches(sgc_content,'href="/pieces/[a-z0-9-]+"','g'))) from __seo_gamme_conseil where sgc_content is not null;
```

## G. Origines des noindex et des 404

```sql
select ua_class, count(*), count(distinct (pg_id,type_id)) pairs, min(ts), max(ts) from __soft_404_events group by 1;
select count(distinct (pg_id,type_id)), count(distinct (pg_id,type_id)) filter (where ts >= now()-interval '90 days') from __soft_404_events;
select err_status, count(*) from __error_logs group by 1 order by 2 desc limit 8;
-- 404/410 par préfixe : aucun /pieces
select err_status, regexp_replace(regexp_replace(err_url,'^https?://[^/]+',''),'^(/[^/?]*(/[^/?]*)?).*','\1') pfx, count(*)
from __error_logs where err_status in (404,410) group by 1,2 order by 3 desc limit 15;
```

## H. Tables de surveillance et CWV (18:35:12Z)

```sql
select relname, n_live_tup from pg_stat_user_tables where relname in ('__seo_gsc_links_weekly','__seo_crawl_log','__seo_index_history','__seo_cwv_daily');
select count(*), max(received_at) from __seo_cwv_raw where received_at > now()-interval '7 days';
select count(*), max(date) from __seo_cwv_daily_rum;
select surface, metric, sum(sample_count), percentile_disc(0.5) within group (order by p75_value)
from __seo_cwv_daily_rum where date >= current_date-28 and metric in ('LCP','INP','CLS') group by 1,2;
```

## I. GET en PROD

Script en lecture seule (`fetch.py`) : 1 requête par 1,05 s, budget de 200
tenu par un fichier compteur, aucune redirection suivie, user-agent
`Mozilla/5.0 (compatible; automecanik-readonly-audit)`. Il journalise l'heure,
l'URL, le code, `X-Robots-Tag`, `Location` et le hash du corps. Les balises
sont extraites par `tags.py` (`HTMLParser`) : title, h1, meta robots, canonical
et `a href`.

| Lot | GET | Début (UTC) | Fin (UTC) | Objet |
|---|---|---|---|---|
| sitemaps | 11 | 18:21:36 | 18:21:52 | index et 10 fichiers |
| b1 | 16 | 18:28:13 | 18:28:34 | 10 R1, 3 conseils, guides |
| b2 | 41 | 18:29:06 | 18:30:03 | liens sans identifiant et cibles R2 et R1 |
| b3 | 3 | 18:31:04 | 18:31:07 | R8 constructeurs |
| b4 | 5 | 18:31:23 | 18:31:34 | cibles R2 non vendables depuis R8 |
| b5 | 47 | 18:31:48 | 18:33:02 | R2 cliquées non vendables |
| b6 | 2 | 18:34:50 | 18:34:52 | R2 à type orphelin |
| b7 | 1 | 18:36:21 | 18:36:21 | robots.txt |

Le compteur de budget final est à 127. Le total des GET reste au plus de 138.

## J. GitHub et disque (18:35:23Z)

```bash
gh pr view 2087 --json number,isDraft,headRefOid,state
gh pr list --state open --limit 200 --json number --jq length
gh run list --status queued --limit 300 --json databaseId --jq length
df -h /
git ls-remote origin refs/heads/main
gh issue list --state open --label dept:07-seo
gh run list --workflow sitemap-daily-regen.yml --limit 5
```

## K. Vérification du patch du registre (sans application)

```bash
git apply --check docs/audit/mandat-cq-seo-07-20261118/registre-seo-07.patch   # dans le worktree : OK, rien appliqué
# copie jetable : git archive HEAD | tar -x -C <scratch> ; git apply <patch> ;
NODE_PATH=/opt/automecanik/app/node_modules node scripts/governance/validate-agent-operating-map.js
# → agent-operating-map: 0 errors, 0 warnings (avant et après patch)
```
