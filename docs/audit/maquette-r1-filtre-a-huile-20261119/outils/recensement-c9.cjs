// Complément n° 9 au mandat DS : recensement des liens des conteneurs éditoriaux des pages R1.
// Pages = <loc> de sitemap-categories.xml (fichier passé en argument), servies par <base> (GET seulement).
// Pour chaque page et chaque bloc (#reference, #bien-choisir, #qualite-prix, #emplacement), lit le HTML
// servi (jsdom, sans exécution de script) : conteneur .gamme-editorial, classes du conteneur (soulignement
// [&_a]:underline présent ou non), et pour chaque lien : classe, contexte (paragraphe, élément de liste seul
// ou avec texte, autre), éléments contenus (img, svg, button, picture…), rôle, classes de bouton ou de carte.
// Usage : node recensement-c9.cjs <base> <sitemap.xml> <sortie.json>
const fs = require("node:fs");
const path = require("node:path");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { JSDOM } = require(path.join(W, "node_modules/jsdom"));
const [, , base, sitemap, out] = process.argv;
const BLOCS = ["reference", "bien-choisir", "qualite-prix", "emplacement"];
const locs = [...fs.readFileSync(sitemap, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

function contexte(a) {
  const p = a.parentElement;
  const t = p.tagName.toLowerCase();
  const autre = [...p.childNodes].filter((n) => n !== a && (n.nodeType === 3 ? n.textContent.replace(/[\s.,;:!?()«»"'’-]/g, "") : true)).length > 0;
  if (t === "p") return "paragraphe";
  if (t === "li") return autre ? "liste avec texte" : "liste seul";
  return `${t}${autre ? " avec texte" : " seul"}`;
}

(async () => {
  const res = { base, sitemap: path.basename(sitemap), pages: locs.length, at: new Date().toISOString(), erreurs: [], parPage: [] };
  for (const loc of locs) {
    let html;
    try {
      const r = await fetch(base + loc);
      if (r.status !== 200) { res.erreurs.push({ loc, status: r.status }); continue; }
      html = await r.text();
    } catch (e) { res.erreurs.push({ loc, erreur: String(e) }); continue; }
    const doc = new JSDOM(html).window.document;
    const page = { loc, blocs: {} };
    for (const id of BLOCS) {
      const conts = [...doc.querySelectorAll(`section#${id} .gamme-editorial`)];
      if (!conts.length) continue;
      page.blocs[id] = conts.map((c) => ({
        souligne: c.className.includes("[&_a]:underline") && c.className.includes("[&_a]:underline-offset-2"),
        liens: [...c.querySelectorAll("a")].map((a) => ({
          href: a.getAttribute("href"),
          texte: a.textContent.trim().slice(0, 80),
          classe: a.getAttribute("class") || "",
          contexte: contexte(a),
          elements: [...a.querySelectorAll("*")].map((e) => e.tagName.toLowerCase()),
          role: a.getAttribute("role") || "",
          boutonOuCarte: /\b(btn|button|card|carte|bg-)\S*/.test(a.getAttribute("class") || "") || a.getAttribute("role") === "button",
        })),
      }));
    }
    res.parPage.push(page);
  }
  // synthèse par bloc
  const syn = {};
  for (const id of BLOCS) {
    const s = (syn[id] = { pagesAvecConteneur: 0, conteneursSoulignes: 0, conteneursNonSoulignes: 0, pagesAvecLiens: 0, liens: 0, seoInternalLink: 0, sansClasse: 0, autresClasses: {}, contextes: {}, avecElements: [], boutonsOuCartes: [] });
    for (const p of res.parPage) {
      const cs = p.blocs[id]; if (!cs) continue;
      s.pagesAvecConteneur++;
      let n = 0;
      for (const c of cs) {
        c.souligne ? s.conteneursSoulignes++ : s.conteneursNonSoulignes++;
        for (const l of c.liens) {
          n++; s.liens++;
          if (l.classe === "seo-internal-link") s.seoInternalLink++;
          else if (!l.classe) { s.sansClasse++; s.contextes[l.contexte] = (s.contextes[l.contexte] || 0) + 1; }
          else s.autresClasses[l.classe] = (s.autresClasses[l.classe] || 0) + 1;
          if (l.elements.length) s.avecElements.push({ loc: p.loc, texte: l.texte, elements: l.elements });
          if (l.boutonOuCarte) s.boutonsOuCartes.push({ loc: p.loc, texte: l.texte, classe: l.classe, role: l.role });
        }
      }
      if (n) s.pagesAvecLiens++;
    }
    // pages qui ont au moins un lien sans classe dans ce bloc (ceux que le changement souligne visiblement)
    s.pagesAvecLienSansClasse = res.parPage.filter((p) => (p.blocs[id] || []).some((c) => c.liens.some((l) => !l.classe))).length;
  }
  const trois = ["bien-choisir", "qualite-prix", "emplacement"];
  syn.troisBlocs = {
    liensSansClasse: trois.reduce((t, id) => t + syn[id].sansClasse, 0),
    liens: trois.reduce((t, id) => t + syn[id].liens, 0),
    pagesAvecLienSansClasse: res.parPage.filter((p) => trois.some((id) => (p.blocs[id] || []).some((c) => c.liens.some((l) => !l.classe)))).length,
  };
  res.synthese = syn;
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  console.log(`pages ${res.pages}, lues ${res.parPage.length}, erreurs ${res.erreurs.length}`);
  for (const id of [...BLOCS, "troisBlocs"]) console.log(id, JSON.stringify(syn[id]));
})().catch((e) => { console.error(e); process.exit(1); });
