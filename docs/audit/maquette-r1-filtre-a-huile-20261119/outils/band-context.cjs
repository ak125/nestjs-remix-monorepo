// Complément n° 4 au mandat DS : capture de contexte (bas du hero + bande) à 1440, pour juger la coupure de l ombre.
// Usage : node band-context.cjs <baseUrl> <sortie.png>. GET seulement.
const path=require("path");const W=process.env.WT||"/home/deploy/worktrees/claude-ds-maquette-r1-20261119";const {chromium}=require(path.join(W,"node_modules/playwright"));
const [, , base, out] = process.argv;
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:"reduce"});
await c.route("**/*",r=>(!["GET","HEAD"].includes(r.request().method())||/google-analytics|googletagmanager|clarity\.ms/.test(r.request().url()))?r.abort():r.continue());
const p=await c.newPage();await p.goto(base+"/pieces/filtre-a-huile-7.html",{waitUntil:"load",timeout:120000});await p.waitForTimeout(3000);
const r=await p.evaluate(()=>{const e=document.querySelector("div.py-4.bg-slate-50.border-b").getBoundingClientRect();return {y:e.y+scrollY,h:e.height}});
await p.screenshot({path:out,clip:{x:0,y:Math.max(0,r.y-260),width:1440,height:260+r.h+60},fullPage:true});await b.close();})();
