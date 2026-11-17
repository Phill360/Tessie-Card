import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const sharp=(await import(pathToFileURL(resolve(process.argv[2])).href)).default;
const base=resolve('assets/tesla/library/pre-2021');
const manifest=JSON.parse(await readFile(resolve(base,'manifest.json'),'utf8'));
const groups=Object.groupBy(manifest.assets.filter(a=>a.status==='downloaded'),a=>[a.model,a.profile,a.kind,a.paint,a.wheel,a.layout,a.view,a.sha256].join('/'));
const ignored=new Set(Object.values(groups).filter(g=>new Set(g.map(a=>a.interior)).size>1).flatMap(g=>g.map(a=>a.file)));
for(const a of manifest.assets.filter(a=>a.status==='downloaded')){
  const {data,info}=await sharp(resolve(base,a.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>=192)opaque++;
  a.opaqueFraction=opaque/(info.width*info.height);
  a.quality=opaque<info.width*info.height*.01?'rejected':ignored.has(a.file)?'needs-review':'sample-family-checked';
  a.review=a.quality==='rejected'?'Rejected: Tesla returned an almost empty/incomplete render.':ignored.has(a.file)?'Interior option is not visually distinct: Tesla returned identical bytes for multiple requested cabin colours. Labels describe the request, not a verified cabin colour.':'Representative body-style sample checked; individual option fidelity still requires visual review.';
}
await writeFile(resolve(base,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const report={downloaded:manifest.assets.filter(a=>a.status==='downloaded').length,unavailable:manifest.assets.filter(a=>a.status!=='downloaded').length,quality:Object.fromEntries(['rejected','needs-review','sample-family-checked'].map(k=>[k,manifest.assets.filter(a=>a.quality===k).length])),uniqueImages:new Set(manifest.assets.filter(a=>a.status==='downloaded').map(a=>a.sha256)).size};
await writeFile(resolve(base,'quality-summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
