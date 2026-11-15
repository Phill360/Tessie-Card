import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { vehicleBounds } from './lib/vehicle-geometry.mjs';
const sharp=(await import(pathToFileURL(resolve(process.argv[2])).href)).default;
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'assets/vehicles');
const catalog=JSON.parse(await readFile(resolve(base,'catalog.json'),'utf8'));
await mkdir(resolve(root,'test-results'),{recursive:true});
const results=[];
for(const [id,image] of Object.entries(catalog.images)){
  const raw=await sharp(resolve(base,image.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const bounds=vehicleBounds(raw.data,raw.info.width,raw.info.height,raw.info.channels);
  if(Math.abs(bounds.width-catalog.framing.width)>3||Math.abs(bounds.left-catalog.framing.left)>3||Math.abs(bounds.top-catalog.framing.top)>3)throw Error('Inconsistent car framing: '+id);
  results.push({image:id,...bounds});
}
const summary={images:results.length,widthRange:[Math.min(...results.map(r=>r.width)),Math.max(...results.map(r=>r.width))],leftRange:[Math.min(...results.map(r=>r.left)),Math.max(...results.map(r=>r.left))],topRange:[Math.min(...results.map(r=>r.top)),Math.max(...results.map(r=>r.top))],results};
await writeFile(resolve(root,'test-results/vehicle-framing-audit.json'),JSON.stringify(summary,null,2)+'\n');
for(const paint of ['PPSW','PBSB']){
  const selected=[...new Map(catalog.entries.filter(a=>a.paint===paint||(paint==='PBSB'&&a.paint==='PX02')).map(a=>[[a.model,a.generation,a.wheel].join('/'),a])).values()];
  const tiles=[];
  for(let i=0;i<selected.length;i++){
    const a=selected[i],label=[a.modelLabel,a.years,a.wheelLabel].join(' · ').replaceAll('&','&amp;').replaceAll('<','&lt;');
    const svg=Buffer.from(`<svg width="1000" height="690"><text x="25" y="665" fill="white" font-family="sans-serif" font-size="28">${label}</text>${a.port?`<circle cx="${a.port[0]}" cy="${a.port[1]}" r="6" fill="#4effa6"/>`:''}</svg>`);
    const composed=await sharp({create:{width:1000,height:690,channels:4,background:'#23272c'}})
      .composite([{input:await readFile(resolve(base,a.image+'.webp')),top:0,left:0},{input:svg,top:0,left:0}]).png().toBuffer();
    const tile=await sharp(composed).resize(400,276).png().toBuffer();
    tiles.push({input:tile,left:(i%4)*400,top:Math.floor(i/4)*276});
  }
  await sharp({create:{width:1600,height:Math.ceil(selected.length/4)*276,channels:4,background:'#23272c'}}).composite(tiles).png().toFile(resolve(root,`test-results/framing-${paint.toLowerCase()}.png`));
}
console.log(JSON.stringify({...summary,results:undefined}));
