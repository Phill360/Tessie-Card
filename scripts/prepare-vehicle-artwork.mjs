// Prepare full-car renders from the local Tesla archive. No runtime Sharp dependency.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { vehicleBounds, vehicleTransform, transformPort } from './lib/vehicle-geometry.mjs';
const sharp=(await import(process.argv[2]?pathToFileURL(resolve(process.argv[2])).href:'sharp')).default;
const root=resolve(import.meta.dirname,'..'), archive=resolve(root,'assets/tesla/library'), destination=resolve(root,'assets/vehicles');
const manifest=JSON.parse(await readFile(resolve(archive,'manifest.json'),'utf8'));
const framing=JSON.parse(await readFile(resolve(destination,'framing.json'),'utf8'));
const exterior=manifest.assets.filter(a=>a.status==='downloaded'&&a.kind==='exterior');
const groups=Object.groupBy(exterior,a=>[a.model,a.profile,a.trim,a.paint,a.interior,a.wheel].join('/'));
const selections=Object.values(groups).map(variants=>{
  const a=variants.find(a=>/REAR/.test(a.view)&&a.profile!=='legacy2018')||variants.find(a=>/FRONT|3QTR/.test(a.view));
  if(!a)throw Error('Missing full-car source');return a;
});
await mkdir(destination,{recursive:true});
const images={}, entries=[], provenance=[];
let previous={images:{}};
if(process.argv.includes('--reuse-images'))try{previous=JSON.parse(await readFile(resolve(destination,'catalog.json'),'utf8'));}catch{}
const unique=[...new Map(selections.map(a=>[a.sha256.slice(0,20),a])).entries()];
let cursor=0,completed=0;
async function prepare(){
  while(cursor<unique.length){
    const [id,a]=unique[cursor++],old=previous.images[id];
    if(old?.normalization?.version===framing.schema){
      const bytes=await readFile(resolve(destination,old.file));
      if(createHash('sha256').update(bytes).digest('hex')!==old.sha256)throw Error('Prepared checksum mismatch: '+id);
      images[id]=old;completed++;continue;
    }
    const input=await readFile(resolve(archive,a.file));
    if(createHash('sha256').update(input).digest('hex')!==a.sha256)throw Error('Source checksum mismatch: '+a.file);
    const raw=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const bounds=vehicleBounds(raw.data,raw.info.width,raw.info.height,raw.info.channels);
    const transform=vehicleTransform(bounds,framing.layout);
    const pad=Math.ceil(bounds.width*.025),bottomPad=Math.ceil(bounds.height*.10);
    const crop={left:Math.max(0,bounds.left-pad),top:Math.max(0,bounds.top-pad)};
    crop.width=Math.min(raw.info.width,bounds.left+bounds.width+pad)-crop.left;
    crop.height=Math.min(raw.info.height,bounds.top+bounds.height+bottomPad)-crop.top;
    const resized=await sharp(input).extract(crop).resize({width:Math.round(crop.width*transform.scale)}).toBuffer({resolveWithObject:true});
    const left=Math.round(transform.offsetX+crop.left*transform.scale),top=Math.round(transform.offsetY+crop.top*transform.scale);
    if(left<0||top<0||left+resized.info.width>1000||top+resized.info.height>625)throw Error('Vehicle outside prepared canvas: '+a.file);
    const bytes=await sharp({create:{width:1000,height:625,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
      .composite([{input:resized.data,left,top}]).webp({quality:84,alphaQuality:95,effort:5}).toBuffer();
    const decoded=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const rendered=vehicleBounds(decoded.data,1000,625,decoded.info.channels);
    if(Math.abs(rendered.width-framing.layout.width)>3||Math.abs(rendered.left-framing.layout.left)>3||Math.abs(rendered.top-framing.layout.top)>3)throw Error('Prepared vehicle failed framing check: '+a.file);
    const filename=id+'.webp';await writeFile(resolve(destination,filename),bytes);
    images[id]={file:filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),normalization:{version:framing.schema,sourceBounds:bounds,...transform,renderedBounds:rendered}};
    completed++;if(completed%20===0)console.log(`Prepared ${completed}/${unique.length} images`);
  }
}
await Promise.all([prepare(),prepare()]);
for(const a of selections){
  const id=a.sha256.slice(0,20),rear=/REAR/.test(a.view),normalization=images[id].normalization;
  const fraction=rear?framing.groups[a.model+'/'+a.profile]?.portFraction:null;
  if(rear&&!fraction)throw Error('Missing port calibration: '+a.model+'/'+a.profile);
  entries.push({id:[a.model,a.profile,a.trim,a.paint,a.interior,a.wheel].map(v=>v.replaceAll('$','')).join(':'),
    model:a.model,modelLabel:a.modelLabel,generation:a.profile,years:a.years,trim:a.trim.replaceAll('$',''),trimLabel:a.trimLabel,
    paint:a.paint.replaceAll('$',''),paintLabel:a.labels.paint,interior:a.interior.replaceAll('$',''),interiorLabel:a.labels.interior,
    wheel:a.wheel.replaceAll('$',''),wheelLabel:a.labels.wheel,image:id,view:rear?'rear':'front',
    port:transformPort(normalization.sourceBounds,normalization,fraction)});
  provenance.push({configuration:entries.at(-1).id,image:id,source:a.url,sourceSha256:a.sha256});
}
entries.sort((a,b)=>a.id.localeCompare(b.id));provenance.sort((a,b)=>a.configuration.localeCompare(b.configuration));
const ordered=Object.fromEntries(Object.entries(images).sort(([a],[b])=>a.localeCompare(b)));
const catalog={schema:2,width:1000,height:625,framing:framing.layout,entries,images:ordered};
await writeFile(resolve(destination,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
await writeFile(resolve(destination,'sources.json'),JSON.stringify(provenance,null,2)+'\n');
const urls=Object.keys(ordered).map(id=>`${JSON.stringify(id)}:new URL("../assets/vehicles/${id}.webp",import.meta.url).href`).join(',\n');
await writeFile(resolve(root,'src/vehicle-artwork-data.js'),`// Generated by scripts/prepare-vehicle-artwork.mjs.\nexport const ARTWORK = ${JSON.stringify(entries)};\nexport const ARTWORK_IMAGES = {\n${urls}\n};\n`);
console.log(JSON.stringify({configurations:entries.length,uniqueImages:Object.keys(images).length,bytes:Object.values(images).reduce((s,a)=>s+a.bytes,0),frontViews:entries.filter(a=>a.view==='front').length}));
