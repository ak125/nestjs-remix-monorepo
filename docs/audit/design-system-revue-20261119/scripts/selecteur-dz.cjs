// Mandat DZ — point 6.5 : sélecteur de véhicule (frontend/app/components/vehicle/VehicleSelector.tsx)
// sur une page, à une taille : états repos, survol, focus, ouvert, désactivé, erreur, chargement ;
// capture et mesures b (contraste texte, contrôlé aux pixels), c (bords), d (cibles), e (indicateur de focus).
// Puis relevé court de l'en-tête, du pied de page et de la barre mobile du bas (captures + mesures b, c, d).
// Erreur et chargement sont provoqués sans écriture : la requête GET de la liste des marques est
// abandonnée (erreur) ou retardée de 5 s (chargement) par l'interception du navigateur.
// Usage : node selecteur-dz.cjs <id> <chemin> <largeur> <hauteur> <dossier-sortie>
const fs = require("node:fs");
const path = require("node:path");
const { chromium, BASE, newContext, settle } = require("./lib-dz.cjs");
const [, , id, route, Ws, Hs, outDir] = process.argv;
const W = Number(Ws), H = Number(Hs); const url = BASE + route;
const cap = (n) => path.join(outDir, "captures", `selecteur-${id}-${W}-${n}.jpg`);
const BRANDS = /\/brands(\?|$)/;

const ROOT_JS = `(() => { const s = [...document.querySelectorAll('select[aria-label="Marque"], select[aria-label*="marque" i]')].find((x) => x.getClientRects().length && getComputedStyle(x).visibility !== "hidden"); if (!s) return null; return s.closest("[data-nosnippet][data-noindex]") || s.closest("form, section, div"); })()`;

async function measure(page, rootExpr, label) {
  const data = await page.evaluate(() => {
    const s0 = [...document.querySelectorAll('select[aria-label="Marque"], select[aria-label*="marque" i]')].find((x) => x.getClientRects().length && getComputedStyle(x).visibility !== "hidden");
    const root = s0 && (s0.closest("[data-nosnippet][data-noindex]") || s0.closest("form, section, div")); if (!root) return { absent: true };
    const textes = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; const seen = new Set();
    while ((n = w.nextNode())) {
      const t = n.nodeValue.trim(); const el = n.parentElement; if (!t || !el || seen.has(el) || el.tagName === "OPTION") continue; seen.add(el);
      if (!__dz.visible(el)) continue;
      const cs = getComputedStyle(el); const bg = __dz.bgOf(el, false);
      let fg = __dz.parse(cs.color); fg = { ...fg, a: fg.a * __dz.opacityChain(el) }; const fgb = __dz.blend(fg, bg.color);
      const px = parseFloat(cs.fontSize), wg = Number(cs.fontWeight); const grand = px >= 24 || (px >= 18.66 && wg >= 700);
      el.setAttribute("data-dz-s", String(textes.length));
      textes.push({ k: textes.length, texte: t.slice(0, 40), sel: __dz.sel(el), fg: __dz.hex(fgb), bg: __dz.hex(bg.color), ratio: __dz.r2(__dz.ratio(fgb, bg.color)), px, graisse: wg, seuil: grand ? 3 : 4.5, inactif: !!el.closest("[disabled]"), fondImage: bg.images.length > 0, translucide: bg.translucide, flou: bg.blur });
    }
    const champs = [...root.querySelectorAll("select, input:not([type=hidden]), button")].filter((e) => __dz.visible(e)).map((e) => {
      const cs = getComputedStyle(e); const out = __dz.bgOf(e, true); let fill = __dz.parse(cs.backgroundColor); fill = fill.a > 0 ? __dz.blend({ ...fill, a: fill.a * __dz.opacityChain(e) }, out.color) : out.color;
      const bw = parseFloat(cs.borderBottomWidth); let bc = __dz.parse(cs.borderBottomColor); bc = __dz.blend({ ...bc, a: bc.a * __dz.opacityChain(e) }, out.color);
      const r = e.getBoundingClientRect();
      return { tag: e.tagName.toLowerCase(), label: (e.getAttribute("aria-label") || e.innerText || "").trim().slice(0, 30), inactif: e.disabled, fondAutour: __dz.hex(out.color), remplissage: __dz.hex(fill), ratioRemplissage: __dz.r2(__dz.ratio(fill, out.color)), bord: bw >= 1 ? __dz.hex(bc) : null, ratioBord: bw >= 1 ? __dz.r2(__dz.ratio(bc, out.color)) : null, fondFlou: out.blur, fondTranslucide: out.translucide, taille: [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10], cible24: r.width >= 24 && r.height >= 24, cible44: r.width >= 44 && r.height >= 44, classes: __dz.cls(e).filter((c) => /border|bg-|ring|outline|opacity/.test(c)).join(" ") };
    });
    return { textes, champs };
  });
  if (data.absent) return { etat: label, absent: true };
  // contrôle aux pixels de chaque texte (fond réellement peint, texte rendu transparent)
  for (const t of data.textes) {
    const loc = page.locator(`[data-dz-s="${t.k}"]`).first();
    try {
      const clip = await loc.evaluate((e) => { const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect(); e.style.setProperty("color", "transparent", "important"); e.style.setProperty("-webkit-text-fill-color", "transparent", "important"); const vw = document.documentElement.clientWidth, vh = innerHeight; const x = Math.max(0, r.left), y = Math.max(0, r.top); return { x, y, width: Math.max(1, Math.min(vw, r.right) - x), height: Math.max(1, Math.min(vh, r.bottom) - y) }; });
      const buf = await page.screenshot({ clip, animations: "disabled" });
      await loc.evaluate((e) => { e.style.removeProperty("color"); e.style.removeProperty("-webkit-text-fill-color"); });
      t.pixels = await page.evaluate(async ({ b64, fg }) => {
        const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data; const f = __dz.parse(fg); const rs = [];
        for (let i = 0; i < d.length; i += 4) rs.push(__dz.ratio(f, { r: d[i], g: d[i + 1], b: d[i + 2] }));
        rs.sort((a, b) => a - b); return { p10: __dz.r2(rs[Math.floor(rs.length * 0.1)]), median: __dz.r2(rs[Math.floor(rs.length / 2)]) };
      }, { b64: buf.toString("base64"), fg: t.fg });
    } catch (e) { t.pixels = { erreur: String(e.message).split("\n")[0] }; }
    t.ratioRetenu = t.pixels && t.pixels.p10 !== undefined ? t.pixels.p10 : t.ratio;
    t.defaut = !t.inactif && t.ratioRetenu < t.seuil;
  }
  await page.evaluate(() => document.querySelectorAll("[data-dz-s]").forEach((e) => e.removeAttribute("data-dz-s")));
  return { etat: label, at: new Date().toISOString(), ...data };
}

async function shotRoot(page, file) {
  const h = await page.evaluateHandle(ROOT_JS); const el = h.asElement(); if (!el) return null;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.screenshot({ path: file, type: "jpeg", quality: 60 }).catch(() => {});
  return path.relative(outDir, file);
}
async function gotoMarque(page) {
  // atteindre la liste « Marque » au clavier, depuis le début du document. Premier passage : on note
  // si le focus tombe sur <body> (élément focalisé devenu inactif). Si Marque n'est pas atteinte,
  // second passage depuis le haut après 2 s (marques chargées), mêmes touches.
  const passages = [];
  for (let pass = 1; pass <= 2; pass++) {
    const pertes = []; let prev = null;
    const etatListes = await page.evaluate(() => [...document.querySelectorAll('select[aria-label="Marque"], select[aria-label*="marque" i]')].map((x) => ({ visible: !!x.getClientRects().length, desactivee: x.disabled, tabIndex: x.tabIndex, options: x.options.length })));
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab"); await page.waitForTimeout(60);
      const st = await page.evaluate(() => { const e = document.activeElement; return { body: !e || e === document.body, marque: !!(e && e.tagName === "SELECT" && /marque/i.test(e.getAttribute("aria-label") || "")), lib: e ? (e.tagName.toLowerCase() + " " + (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30)) : "" }; });
      if (st.body) pertes.push({ tabulation: i + 1, apres: prev });
      if (st.marque) { passages.push({ passage: pass, atteinteA: i + 1, pertes, etatListes }); return { tabs: i + 1, passages }; }
      prev = st.lib;
    }
    passages.push({ passage: pass, atteinteA: null, pertes, etatListes });
    await page.waitForTimeout(2000); await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo({ top: 0, behavior: "instant" }); });
  }
  return { tabs: null, passages };
}

(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const out = { id, route, viewport: `${W}x${H}`, debut: new Date().toISOString(), etats: [] };
  const open = async (mode) => {
    const ctx = await newContext(browser, { width: W, height: H, aborted });
    if (mode === "erreur") await ctx.route(BRANDS, (r) => { aborted.push({ method: r.request().method(), url: r.request().url().replace(BASE, ""), raison: "abandon volontaire (état erreur)" }); return r.abort("failed"); });
    if (mode === "chargement") await ctx.route(BRANDS, async (r) => { await new Promise((ok) => setTimeout(ok, 5000)); return r.continue(); });
    const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await settle(p, 4000);
    await p.evaluate(`(() => { const r = ${ROOT_JS}; if (r) r.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await p.waitForTimeout(400);
    return { ctx, p };
  };
  // repos + désactivé (Année, Modèle, Motorisation et bouton sont inactifs tant qu'aucune marque n'est choisie)
  {
    const { ctx, p } = await open();
    const m = await measure(p, ROOT_JS, "repos (+ champs désactivés)"); m.capture = await shotRoot(p, cap("repos"));
    out.etats.push(m);
    if (W >= 800) {
      const sel = p.locator('select[aria-label="Marque"], select[aria-label*="marque" i]').filter({ visible: true }).first();
      await sel.hover(); await p.waitForTimeout(500);
      const s = await measure(p, ROOT_JS, "survol de la liste Marque"); s.capture = await shotRoot(p, cap("survol")); out.etats.push(s);
    } else out.etats.push({ etat: "survol", nonApplicable: "écran tactile (390 px) : pas de survol" });
    await ctx.close();
  }
  // focus au clavier + ouvert
  {
    const { ctx, p } = await open();
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const gm = await gotoMarque(p); const tabs = gm.tabs; out.parcoursClavierMarque = gm.passages;
    if (tabs) {
      await p.waitForTimeout(1500); // le focus déclenche le chargement des marques
      const r = await p.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, boxShadow: cs.boxShadow.slice(0, 160), bord: cs.borderBottomColor, focusVisible: e.matches(":focus-visible"), options: e.options.length }; });
      const clipOf = () => p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: Math.max(0, r.left - 5), y: Math.max(0, r.top - 5), width: r.width + 10, height: r.height + 10 }; });
      const c1 = await clipOf(); const a = await p.screenshot({ clip: c1 });
      const m = await measure(p, ROOT_JS, "focus clavier sur Marque"); m.capture = await shotRoot(p, cap("focus"));
      await p.keyboard.press("Shift+Tab"); await p.waitForTimeout(300);
      const b = await p.screenshot({ clip: c1 });
      m.indicateur = await p.evaluate(async ({ a, b }) => {
        const load = async (s) => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
        const A = await load(a), B = await load(b); const rs = [];
        for (let i = 0; i < A.data.length; i += 4) { const p1 = { r: A.data[i], g: A.data[i + 1], b: A.data[i + 2] }, q = { r: B.data[i], g: B.data[i + 1], b: B.data[i + 2] }; if (Math.abs(p1.r - q.r) + Math.abs(p1.g - q.g) + Math.abs(p1.b - q.b) >= 12) rs.push(__dz.ratio(p1, q)); }
        rs.sort((x, y) => x - y); return { pixelsChanges: rs.length, ratioP90: rs.length ? __dz.r2(rs[Math.floor(rs.length * 0.9)]) : 0, ratioMax: rs.length ? __dz.r2(rs[rs.length - 1]) : 0 };
      }, { a: a.toString("base64"), b: b.toString("base64") });
      m.styleFocus = r; m.tabulationsDepuisLeDebut = tabs; out.etats.push(m);
      out.etats.push({ etat: "ouvert", nonMesurable: "liste native <select> : le menu déroulant est dessiné par le navigateur / le système, il n'apparaît pas dans une capture sans interface ; options présentes : " + r.options });
    } else out.etats.push({ etat: "focus clavier sur Marque", nonAtteint: "liste Marque non atteinte en 2 passages de 80 tabulations", passages: gm.passages });
    await ctx.close();
  }
  // chargement (liste des marques retardée de 5 s)
  {
    const { ctx, p } = await open("chargement");
    await p.locator('select[aria-label="Marque"], select[aria-label*="marque" i]').filter({ visible: true }).first().focus().catch(() => {});
    await p.waitForTimeout(900);
    const m = await measure(p, ROOT_JS, "chargement des marques (réponse retardée 5 s)"); m.capture = await shotRoot(p, cap("chargement"));
    m.indiceChargement = await p.evaluate(`(() => { const r = ${ROOT_JS}; return r ? { busy: r.querySelectorAll("[aria-busy=true]").length, spinner: r.querySelectorAll(".animate-spin").length, marqueInactive: !!r.querySelector('select[aria-label="Marque"]:disabled'), texteOption: (r.querySelector('select[aria-label="Marque"] option') || {}).textContent } : null; })()`);
    out.etats.push(m); await ctx.close();
  }
  // erreur (liste des marques abandonnée)
  {
    const { ctx, p } = await open("erreur");
    await p.locator('select[aria-label="Marque"], select[aria-label*="marque" i]').filter({ visible: true }).first().focus().catch(() => {});
    await p.waitForTimeout(2500);
    const m = await measure(p, ROOT_JS, "erreur de chargement des marques"); m.capture = await shotRoot(p, cap("erreur"));
    m.messageErreur = await p.evaluate(`(() => { const r = ${ROOT_JS}; const e = r && r.querySelector(".text-red-600"); return e ? e.innerText.trim().slice(0, 80) : null; })()`);
    out.etats.push(m); await ctx.close();
  }
  // en-tête, pied de page, barre mobile : captures (mesures b, c, d, e reprises de mesure-dz.cjs par zone)
  {
    const { ctx, p } = await open();
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(300);
    out.chrome = {};
    for (const [nom, s] of [["en-tete", 'nav[aria-label="Navigation principale"]'], ["pied-de-page", "footer"], ["barre-mobile", 'nav[aria-label="Navigation mobile"]']]) {
      const loc = p.locator(s).first();
      if (!(await loc.count()) || !(await loc.isVisible())) { out.chrome[nom] = "absent ou masqué à cette taille"; continue; }
      const f = path.join(outDir, "captures", `${nom}-${id}-${W}.jpg`);
      await loc.screenshot({ path: f, type: "jpeg", quality: 55 }).catch((e) => (out.chrome[nom] = String(e.message).split("\n")[0]));
      if (!out.chrome[nom]) out.chrome[nom] = path.relative(outDir, f);
    }
    await ctx.close();
  }
  out.requetesAbandonnees = aborted; out.fin = new Date().toISOString();
  await browser.close();
  fs.writeFileSync(path.join(outDir, "mesures", `selecteur-${id}-${W}.json`), JSON.stringify(out, null, 1));
  console.log(`[selecteur-${id}-${W}]`, JSON.stringify(out.etats.map((e) => [e.etat, e.textes ? e.textes.filter((t) => t.defaut).length : "-", e.champs ? e.champs.filter((c) => !c.inactif && Math.max(c.ratioRemplissage, c.ratioBord || 0) < 3 && c.tag !== "button").length : "-", e.indicateur ? e.indicateur.ratioP90 : ""])));
})().catch((e) => { console.error(e); process.exit(1); });
