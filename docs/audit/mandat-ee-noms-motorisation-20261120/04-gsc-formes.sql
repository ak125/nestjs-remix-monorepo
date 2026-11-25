-- Mandat EE, 6.3 : forme brute contre forme d'affichage dans les requêtes GSC (90 jours).
-- Lecture seule. Fenêtre = 90 derniers jours de données présentes dans __seo_gsc_daily.
-- Les requêtes anonymisées par Google (part mesurée dans 05) n'apparaissent pas ici.
\o gsc-formes.tsv
copy (
with fen as (select max(date) as fin, max(date) - 89 as debut from __seo_gsc_daily),
g as (
  select regexp_replace(translate(lower(d.query), 'ëéèêàâîïôöûüç', 'eeeeaaiioouuc'), '[^a-z0-9]+', ' ', 'g') as q,
         sum(d.impressions) as imp, sum(d.clicks) as clk
  from __seo_gsc_daily d, fen
  where d.date between fen.debut and fen.fin and d.query is not null and d.query <> ''
  group by 1
),
p(statut, paire, contexte, brute, affichee) as (values
  ('erreur','Ford EcoBoost→Econetic','\mford\M','\meco ?boost\M','\meconetic\M'),
  ('erreur','Fiat D Multijet→JTD','\mfiat\M','\mmulti ?jet\M','\mjtd\M'),
  ('erreur','Lancia D Multijet→JTD','\mlancia\M','\mmulti ?jet\M','\mjtd\M'),
  ('erreur','Toyota VVTi→VTi','\mtoyota\M|\myaris\M|\mauris\M','\mvvt ?i\M','\mvti\M'),
  ('erreur','Citroën THP→VTi','\mcitroen\M|\mds ?3\M|\mc3\M','\mthp\M','\mvti\M'),
  ('erreur','Audi TFSI→TSI','\maudi\M|\ma3\M','\mtfsi\M','\mtsi\M'),
  ('erreur','Audi TDI→DI','\maudi\M|\ma4\M','\mtdi\M','\mdi\M'),
  ('erreur','BMW 320d→328d','\mbmw\M|\mserie 3\M|\mf3[01]\M','\m320 ?d\M','\m328 ?d\M'),
  ('erreur','BMW 520→523','\mbmw\M|\mserie 5\M|\mf1[01]\M','\m520 ?[di]?\M','\m523 ?[di]?\M'),
  ('erreur','BMW 530d→535d','\mbmw\M|\mserie 5\M|\mf1[01]\M','\m530 ?d\M','\m535 ?d\M'),
  ('erreur','BMW X3 20d→28d','\mx3\M','\m20 ?d\M','\m28 ?d\M'),
  ('erreur','BMW X5 30d→35d','\mx5\M','\m30 ?d\M','\m35 ?d\M'),
  ('erreur','Mercedes GLC 220d→200d','\mglc\M','\m220 ?d\M','\m200 ?d\M'),
  ('erreur','Mercedes C 200d↔220d','\mclasse c\M|\mc205\M|\mc 2[02]0\M','\m200 ?d\M','\m220 ?d\M'),
  ('erreur','Mercedes Sprinter 311→313','\msprinter\M','\m311\M','\m313\M'),
  ('erreur','Mercedes GLE 250d→300d','\mgle\M','\m250 ?d\M','\m300 ?d\M'),
  ('erreur','Mercedes CLA 250→260','\mcla\M','\m250\M','\m260\M'),
  ('erreur','Renault dTi→TDi','\mrenault\M|\mespace\M','\mdti\M','\mtdi\M'),
  ('erreur','Mazda MZR→MRZ','\mmazda\M','\mmzr\M','\mmrz\M'),
  ('erreur','Hyundai CRDi→CDi','\mhyundai\M|\mtucson\M','\mcrdi\M','\mcdi\M'),
  ('erreur','Jeep CRD→CRDi','\mjeep\M|\mcherokee\M','\mcrd\M','\mcrdi\M'),
  ('erreur','Mini Cooper S→SX','\mmini\M|\mclubman\M','\mcooper s\M','\msx\M'),
  ('erreur','Alfa TJet/MultiAir→TB','\malfa\M|\mmito\M','\mt ?jet\M|\mmulti ?air\M','\mtb\M'),
  ('erreur','Ford TDDi/TDCi→TDi','\mford\M|\mmondeo\M|\mranger\M','\mtddi\M|\mtdci\M','\mtdi\M'),
  ('erreur','Citroën/Peugeot BlueHDi→HDi','\mcitroen\M|\mpeugeot\M|\mds ?3\M|\mberlingo\M|\mpartner\M','\mblue ?hdi\M','\mhdi\M'),
  ('incertain','Opel DGI→Direct','\mopel\M','\mdgi\M','\mdirect\M'),
  ('incertain','Toyota D-4D ajouté','\mtoyota\M','','\md ?4 ?d\M'),
  ('incertain','Toyota VTi ajouté','\mtoyota\M','','\mvti\M'),
  ('incertain','16V ajouté (Opel, Nissan, Dacia, Toyota)','\mopel\M|\mnissan\M|\mdacia\M|\mtoyota\M','','\m16 ?v\M'),
  ('incertain','Citroën D→D12','\mcitroen\M','','\md12\M'),
  ('incertain','Renault TD RT→RTdT','\mrenault\M','','\mrtdt\M'),
  ('incertain','Mini SD→SDX','\mmini\M','\mcooper sd\M','\msdx\M'),
  ('incertain','Mercedes CGI ajouté','\mmercedes\M','','\mcgi\M'),
  ('incertain','Mazda Skyaktiv (sic) ajouté','\mmazda\M','\mskyactiv\M','\mskyaktiv\M'),
  ('incertain','Alfa Quadrifoglio ajouté','\malfa\M','','\mquadrifoglio\M')
)
select p.statut, p.paire,
       count(*) filter (where g.q ~ p.brute and p.brute <> '') as req_brute,
       coalesce(sum(g.imp) filter (where g.q ~ p.brute and p.brute <> ''), 0) as imp_brute,
       coalesce(sum(g.clk) filter (where g.q ~ p.brute and p.brute <> ''), 0) as clics_brute,
       count(*) filter (where g.q ~ p.affichee) as req_affichee,
       coalesce(sum(g.imp) filter (where g.q ~ p.affichee), 0) as imp_affichee,
       coalesce(sum(g.clk) filter (where g.q ~ p.affichee), 0) as clics_affichee,
       (select fin from fen) as derniere_date
from p left join g on g.q ~ p.contexte
group by p.statut, p.paire order by 1, 4 desc, 2
) to stdout with (format csv, delimiter E'\t', header);
\o
