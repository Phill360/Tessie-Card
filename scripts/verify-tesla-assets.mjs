import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { inflateSync } from 'node:zlib';

const archive=resolve(import.meta.dirname,'../assets/tesla/library');
const manifest=JSON.parse(await readFile(resolve(archive,'manifest.json'),'utf8'));
const failures=[], hashes=new Map(); let totalBytes=0, checked=0;
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(data){let crc=0xffffffff;for(const n of data)crc=crcTable[(crc^n)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
for(const a of manifest.assets.filter(a=>a.status==='downloaded')){
  try{
    const path=resolve(archive,a.file);if(!path.startsWith(archive+sep))throw Error('Path outside archive');
    const b=await readFile(path);if(b.length!==a.bytes)throw Error('Size mismatch');
    if(createHash('sha256').update(b).digest('hex')!==a.sha256)throw Error('Checksum mismatch');
    if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG signature');
    if(b.readUInt32BE(16)!==a.width||b.readUInt32BE(20)!==a.height)throw Error('Dimension mismatch');
    const idat=[];let end=false;
    for(let p=8;p+12<=b.length;){const n=b.readUInt32BE(p);if(p+12+n>b.length)throw Error('Truncated chunk');
      const type=b.toString('ascii',p+4,p+8);if(crc32(b.subarray(p+4,p+8+n))!==b.readUInt32BE(p+8+n))throw Error('PNG chunk checksum failed');
      if(type==='IDAT')idat.push(b.subarray(p+8,p+8+n));if(type==='IEND')end=true;p+=n+12;}
    if(!end||!idat.length)throw Error('Incomplete PNG');
    const raw=inflateSync(Buffer.concat(idat),{maxOutputLength:300_000_000});
    if(!raw.length)throw Error('No pixel data');
    (hashes.get(a.sha256)||hashes.set(a.sha256,[]).get(a.sha256)).push(a);
    totalBytes+=b.length;checked++;
  }catch(error){failures.push({file:a.file,error:error.message});}
}
const duplicateGroups=[...hashes.values()].filter(g=>g.length>1);
const suspicious=duplicateGroups.filter(g=>
  (g[0].kind==='exterior'&&new Set(g.map(a=>a.paint)).size>1)||
  (g[0].kind==='wheel'&&new Set(g.map(a=>a.labels.wheel)).size>1)||
  (g[0].kind==='interior'&&new Set(g.map(a=>a.labels.interior)).size>1));
const report={verifiedAt:new Date().toISOString(),checked,totalBytes,uniqueImages:hashes.size,integrityFailures:failures,
  unavailable:manifest.assets.filter(a=>a.status==='unavailable').map(({file,error})=>({file,error})),
  duplicateGroups:duplicateGroups.map(g=>g.map(a=>a.file)),
  potentialIgnoredOptions:suspicious.map(g=>g.map(({file,paint,wheel,interior})=>({file,paint,wheel,interior}))),
  note:'Checksums and PNG integrity do not verify visual fidelity. Duplicate option requests may legitimately share artwork.'};
await writeFile(resolve(archive,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked,totalBytes,uniqueImages:hashes.size,integrityFailures:failures.length,unavailable:report.unavailable.length,potentialIgnoredOptions:suspicious.length}));
if(failures.length)process.exitCode=1;
