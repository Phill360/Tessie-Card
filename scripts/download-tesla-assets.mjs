// Local, resumable Tesla compositor archive. Nothing is fetched by the card.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const archive = resolve(root, 'assets/tesla/library');
const catalogPath = resolve(root, 'assets/tesla/catalog/models.json');
const args = process.argv.slice(2);
const only = args.find(x => x.startsWith('--model='))?.split('=')[1];
const limit = Number(args.find(x => x.startsWith('--limit='))?.split('=')[1] || Infinity);
const concurrency = Number(args.find(x => x.startsWith('--concurrency='))?.split('=')[1] || 3);

// Parse the downloaded reference's data literal, without executing its script.
function parseLiteral(text) {
  const tokens = text.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|-?\d+(?:\.\d+)?|[{}\[\]:,]/g)
    .filter(t => !t.startsWith('//') && !t.startsWith('/*'));
  let i = 0;
  const string = t => t[0] === '"' ? JSON.parse(t) : t.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  function value() {
    const t = tokens[i++];
    if (t === '{') {
      const out = {};
      while (tokens[i] !== '}') {
        const key = tokens[i++];
        if (tokens[i++] !== ':') throw Error('Invalid catalog property');
        out[/^["']/.test(key) ? string(key) : key] = value();
        if (tokens[i] === ',') i++; else if (tokens[i] !== '}') throw Error('Invalid catalog object');
      }
      i++; return out;
    }
    if (t === '[') {
      const out = [];
      while (tokens[i] !== ']') { out.push(value()); if (tokens[i] === ',') i++; else if (tokens[i] !== ']') throw Error('Invalid catalog array'); }
      i++; return out;
    }
    if (/^["']/.test(t)) return string(t);
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null') return null;
    if (/^-?\d/.test(t)) return Number(t);
    throw Error(`Unsupported catalog token: ${t}`);
  }
  const result = value();
  if (i !== tokens.length) throw Error('Trailing catalog data');
  return result;
}

if (args.includes('--import-reference')) {
  const html = await readFile(resolve(root, 'assets/tesla/catalog/reference-configurator.html'), 'utf8');
  const literal = html.match(/const MODELS = ([\s\S]*?);\s*const el =/)[1].trim();
  await writeFile(catalogPath, JSON.stringify(parseLiteral(literal), null, 2) + '\n');
  console.log('Imported static model catalog.');
}
const models = JSON.parse(await readFile(catalogPath, 'utf8'));
const split = v => (Array.isArray(v) ? v : [v]).filter(Boolean).flatMap(x => x.split(',').filter(Boolean));
const slug = v => String(v || 'default').replace(/\$/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase();
const entries = obj => Object.entries(obj || { '': 'Default' });
function makeUrl(cfg, selection) {
  const { trim, paint, wheel, interior, layout, steering, view } = selection;
  const interiorOnly = cfg.steeringPlacement === 'interiorOnly' && view === cfg.interiorViewKey;
  const g = {
    TRIM_PREFIX: split(cfg.trimPrefixesByTrim?.[trim]), TRIM_MIDDLE: split(cfg.trimMiddleByTrim?.[trim]),
    TRIM_SUFFIX: split(cfg.trimSuffixesByTrim?.[trim]), MODEL_OPTION: split(cfg.fixed.modelOption),
    TRIM: split(trim), PAINT: split(paint), WHEEL: interiorOnly ? [] : split(wheel), LAYOUT: split(layout),
    INTERIOR: split(interior), STEERING: cfg.steeringPlacement === 'always' || interiorOnly ? split(steering) : [],
    FIXED_EXTRAS: split(cfg.fixed.extraOptions), EXTRAS: []
  };
  const sequence = cfg.optionSequence || (cfg.steeringPlacement === 'always'
    ? ['TRIM_PREFIX','MODEL_OPTION','TRIM','PAINT','WHEEL','LAYOUT','TRIM_MIDDLE','FIXED_EXTRAS','TRIM_SUFFIX','EXTRAS','INTERIOR','STEERING']
    : ['TRIM_PREFIX','MODEL_OPTION','TRIM','PAINT','WHEEL','LAYOUT','TRIM_MIDDLE','FIXED_EXTRAS','INTERIOR','STEERING','TRIM_SUFFIX','EXTRAS']);
  const options = sequence.flatMap(k => g[k] || [k]);
  const params = { options: options.join(','), view, model: cfg.fixed.model, size: '1440', bkba_opt: '1' };
  for (const key of ['context','crop','overlay','version']) if (cfg.fixed[key]) params[key] = cfg.fixed[key];
  // Keep Tesla's conventional literal $ and comma option syntax.
  return cfg.base + '?' + Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v).replace(/%24/g,'$').replace(/%2C/g,',')}`).join('&');
}

const jobs = [];
for (const [model, definition] of Object.entries(models)) {
  if (only && !only.split(',').includes(model)) continue;
  for (const [profile, cfg] of Object.entries(definition.profiles)) {
    for (const [trim, trimLabel] of entries(cfg.trims)) {
      const wheels = entries(cfg.wheelsByTrim[trim]);
      const interiors = entries(cfg.interiorsByTrim[trim]);
      const layouts = entries(cfg.layoutsByTrim?.[trim] || cfg.layouts);
      const steeringOptions = entries(cfg.steeringByTrim?.[trim] || cfg.steering);
      const views = Object.keys(cfg.views);
      const exteriorViews = views.filter(v => /FRONT|3QTR|REAR/i.test(v));
      const interiorView = views.find(v => /INTERIOR|SEAT/.test(v));
      const wheelView = views.find(v => /RIM|WHEEL/.test(v));
      const add = (kind, selection, labels) => {
        const url = makeUrl(cfg, selection);
        const parts = [kind, selection.paint, selection.wheel, selection.interior, selection.layout, selection.steering, selection.view];
        const file = `${model}/${profile}/${slug(trim)}/${parts.map(slug).join('_')}.png`;
        jobs.push({ model, modelLabel: definition.label, profile, years: cfg.label, trimLabel, kind, ...selection, labels, file, url });
      };
      // Exterior renders include interior colour visible through the windows.
      // Seat and steering variations are archived in the cabin views separately.
      for (const [paint, paintLabel] of entries(cfg.paints)) for (const [wheel,wheelLabel] of wheels)
        for (const [interior,interiorLabel] of interiors) for (const view of exteriorViews) {
          const layout = cfg.defaults.layout || layouts[0][0];
          const steering = cfg.defaults.steering || steeringOptions[0][0];
          add('exterior', {trim,paint,wheel,interior,layout,steering,view}, {paint:paintLabel,wheel:wheelLabel,interior:interiorLabel});
        }
      for (const [interior,interiorLabel] of interiors) for (const [layout,layoutLabel] of layouts)
        for (const [steering,steeringLabel] of steeringOptions) if (interiorView) {
          add('interior', {trim,paint:cfg.defaults.paint,wheel:wheels[0][0],interior,layout,steering,view:interiorView}, {interior:interiorLabel,layout:layoutLabel,steering:steeringLabel});
        }
      if (wheelView) for (const [wheel,wheelLabel] of wheels) add('wheel', {trim,paint:cfg.defaults.paint,wheel,interior:interiors[0][0],layout:cfg.defaults.layout || layouts[0][0],steering:cfg.defaults.steering || steeringOptions[0][0],view:wheelView}, {wheel:wheelLabel});
    }
  }
}

await mkdir(archive, {recursive:true});
const manifestPath = resolve(archive, 'manifest.json');
let previous = [];
try { previous = JSON.parse(await readFile(manifestPath,'utf8')).assets; } catch {}
const records = new Map(previous.map(x => [x.file,x]));
const sampled = new Set();
const selectedJobs = jobs.filter(job => {
  if (!args.includes('--sample')) return true;
  const key = `${job.model}/${job.profile}/${job.kind}`;
  if (sampled.has(key)) return false;
  sampled.add(key); return true;
}).slice(0,limit);
await writeFile(resolve(archive,'plan.json'),JSON.stringify({generatedAt:new Date().toISOString(),total:jobs.length,jobs},null,2)+'\n');
console.log(`Planned ${jobs.length} images; processing ${selectedJobs.length}, concurrency ${concurrency}.`);
if (args.includes('--plan-only')) process.exit(0);

function validate(bytes) {
  if (bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw Error('Not a PNG');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width < 256 || height < 100 || width > 8192 || height > 8192) throw Error('Invalid PNG dimensions');
  const data = []; let ended = false;
  for (let p=8;p+12<=bytes.length;) {
    const length=bytes.readUInt32BE(p), type=bytes.toString('ascii',p+4,p+8);
    if (p+12+length > bytes.length) throw Error('Truncated PNG');
    if (type === 'IDAT') data.push(bytes.subarray(p+8,p+8+length));
    if (type === 'IEND') ended=true;
    p += length+12;
  }
  if (!ended || !data.length) throw Error('Incomplete PNG');
  const raw = inflateSync(Buffer.concat(data),{maxOutputLength:300_000_000});
  if (raw.length < height) throw Error('Empty PNG');
  return {width,height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
let cursor=0, completed=0;
async function saveManifest() {
  const assets = [...records.values()].sort((a,b)=>a.file.localeCompare(b.file));
  const hashes = new Map();
  for (const a of assets) if (a.sha256) { if(hashes.has(a.sha256)) a.identicalTo=hashes.get(a.sha256); else { hashes.set(a.sha256,a.file); delete a.identicalTo; } }
  await writeFile(manifestPath,JSON.stringify({updatedAt:new Date().toISOString(),resolution:1440,assets},null,2)+'\n');
}
let saving=Promise.resolve();
async function worker() {
  while (cursor < selectedJobs.length) {
    const job=selectedJobs[cursor++], path=resolve(archive,job.file), old=records.get(job.file);
    if (old?.status==='downloaded' && !args.includes('--refresh')) {
      try { if ((await stat(path)).size===old.bytes) { completed++; continue; } } catch {}
    }
    try {
      const response=await fetch(job.url,{signal:AbortSignal.timeout(35000)});
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      const details=validate(bytes);
      await mkdir(dirname(path),{recursive:true});
      await writeFile(path,bytes);
      records.set(job.file,{...job,status:'downloaded',downloadedAt:new Date().toISOString(),...details,review:'pending visual review; HTTP success does not verify option fidelity'});
    } catch(error) { records.set(job.file,{...job,status:'unavailable',error:error.message}); }
    completed++;
    if(completed%20===0) {
      saving=saving.then(saveManifest); await saving;
      const all=[...records.values()];
      console.log(`${completed}/${selectedJobs.length}: ${all.filter(x=>x.status==='downloaded').length} PNGs saved, ${all.filter(x=>x.status==='unavailable').length} unavailable.`);
    }
    await new Promise(r=>setTimeout(r,150));
  }
}
await Promise.all(Array.from({length:concurrency},worker));
await saving; await saveManifest();
const all=[...records.values()];
console.log(JSON.stringify({downloaded:all.filter(x=>x.status==='downloaded').length,unavailable:all.filter(x=>x.status==='unavailable').length,uniqueImages:new Set(all.map(x=>x.sha256).filter(Boolean)).size}));
