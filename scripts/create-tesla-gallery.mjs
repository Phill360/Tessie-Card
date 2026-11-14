import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const directory = resolve(root, 'assets/tesla/library');
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
const assets = manifest.assets.filter(a => a.status === 'downloaded').map(a => {
  if (a.model === 'm3' && a.profile === 'legacy2018' && a.view === 'STUD_REAR') {
    return {...a, kind:'detail', review:'Visual sample checked: Tesla returns a taillight close-up for this rear-view code.'};
  }
  return a;
});
const failures = manifest.assets.filter(a => a.status !== 'downloaded');
const json = JSON.stringify(assets).replace(/</g, '\\u003c');
await writeFile(resolve(directory, 'index.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tesla render library</title>
<style>
body{font:15px system-ui,sans-serif;margin:0;background:#eceff3;color:#18202b}header{padding:24px;background:white;position:sticky;top:0;z-index:1;box-shadow:0 1px 8px #0001}h1{margin:0 0 8px;font-size:26px}p{margin:8px 0;color:#4c5666}nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}select,input{font:inherit;padding:8px;border:1px solid #b7bfcc;border-radius:6px;max-width:240px}main{padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}article{background:white;border:1px solid #d5dbe4;border-radius:10px;overflow:hidden}article img{width:100%;aspect-ratio:16/9;object-fit:contain;background:#dfe3e8}article div{padding:12px}article h2{font-size:16px;margin:0 0 8px}article p{font-size:13px;margin:4px 0}a{color:#2056a3}small{display:block;color:#5c6470;margin-top:8px}#count{font-weight:600}
</style>
<header><h1>Tesla render library</h1><p>Local Model 3 and Model Y artwork. Original Tesla files; no network connection required.</p>
<p>${assets.length} downloaded configurations · ${failures.length} unavailable requests. Option names follow the source catalog; unreviewed combinations can contain server fallbacks.</p>
<nav><label>Model <select id="model"></select></label><label>Generation <select id="profile"></select></label><label>View <select id="kind"></select></label><input id="search" aria-label="Search variants" placeholder="Paint, wheel, interior or trim"></nav><p id="count" aria-live="polite"></p></header><main id="grid"></main>
<script>
const assets=${json};
const selects={model:document.querySelector('#model'),profile:document.querySelector('#profile'),kind:document.querySelector('#kind')};
for(const [key,select] of Object.entries(selects)){
const values=[...new Set(assets.map(a=>key==='model'?a.modelLabel:key==='profile'?a.years:a.kind))].sort();
for(const value of ['All',...values]){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option)}select.addEventListener('change',render)}
const search=document.querySelector('#search');search.addEventListener('input',render);
function render(){const query=search.value.trim().toLowerCase();const filtered=assets.filter(a=>(selects.model.value==='All'||a.modelLabel===selects.model.value)&&(selects.profile.value==='All'||a.years===selects.profile.value)&&(selects.kind.value==='All'||a.kind===selects.kind.value)&&[a.trimLabel,...Object.values(a.labels),a.view,a.wheel,a.interior,a.paint].join(' ').toLowerCase().includes(query));
document.querySelector('#count').textContent=filtered.length+' matching renders';const grid=document.querySelector('#grid');grid.replaceChildren();
for(const a of filtered){const article=document.createElement('article');const link=document.createElement('a');link.href=a.file;link.target='_blank';const img=document.createElement('img');img.loading='lazy';img.src=a.file;img.alt=[a.modelLabel,a.years,a.trimLabel,...Object.values(a.labels),a.view].join(' · ');link.append(img);article.append(link);const body=document.createElement('div');const title=document.createElement('h2');title.textContent=a.modelLabel+' '+a.years+' · '+a.trimLabel;body.append(title);for(const line of [Object.values(a.labels).join(' · '),a.kind+' · '+a.view]){const p=document.createElement('p');p.textContent=line;body.append(p)}const review=document.createElement('small');review.textContent=a.identicalTo?'Identical file also returned for another configuration.':a.review;body.append(review);article.append(body);grid.append(article)}}render();
</script></html>`);
const groups = {};
for (const a of manifest.assets) {
  const key = `${a.modelLabel} ${a.years}`;
  groups[key] ||= {downloaded:0,unavailable:0,unique:new Set()};
  groups[key][a.status === 'downloaded' ? 'downloaded' : 'unavailable']++;
  if (a.sha256) groups[key].unique.add(a.sha256);
}
const report = Object.fromEntries(Object.entries(groups).map(([key,v]) => [key,{...v,unique:v.unique.size}]));
await writeFile(resolve(directory,'summary.json'),JSON.stringify({updatedAt:manifest.updatedAt,total:assets.length,unavailable:failures.length,groups:report},null,2)+'\n');
console.log(JSON.stringify(report,null,2));
