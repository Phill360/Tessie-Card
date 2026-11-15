import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ARTWORK, ARTWORK_IMAGES, ARTWORK_FIELDS, DEFAULT_ARTWORK, selectArtwork, artworkOptions, changeArtwork } from '../src/vehicle-artwork.js';
import { validateConfig } from '../src/tessie-card.js';

test('prepared catalog covers every downloaded exterior configuration with a full car view', async () => {
  const catalog=JSON.parse(await readFile(new URL('../assets/vehicles/catalog.json',import.meta.url),'utf8'));
  assert.equal(ARTWORK.length,catalog.entries.length);
  assert.ok(ARTWORK.length>300);
  assert.deepEqual([...new Set(ARTWORK.map(a=>a.model))].sort(),['m3','my']);
  assert.equal(new Set(ARTWORK.map(a=>`${a.model}/${a.generation}`)).size,5);
  assert.equal(new Set(ARTWORK.map(a=>a.id)).size,ARTWORK.length);
  assert.equal(catalog.schema,2);
  for(const a of ARTWORK){assert.ok(ARTWORK_IMAGES[a.image]);assert.ok(a.port===null||a.port.every(Number.isFinite));if(a.generation==='legacy2018')assert.equal(a.view,'front');}
  for(const image of Object.values(catalog.images)){
    assert.equal(image.normalization.version,2);
    const bounds=image.normalization.renderedBounds;
    assert.ok(Math.abs(bounds.width-catalog.framing.width)<=3,image.file+' changed vehicle size');
    assert.ok(Math.abs(bounds.left-catalog.framing.left)<=3,image.file+' shifted horizontally');
    assert.ok(Math.abs(bounds.top-catalog.framing.top)<=3,image.file+' shifted vertically');
    const bytes=await readFile(new URL('../assets/vehicles/'+image.file,import.meta.url));
    assert.equal(bytes.length,image.bytes);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
  }
});

test('Model Y Gemini and Induction retain matching scale and charge-port registration',()=>{
  const base={model:'my',generation:'legacy2020',trim:'MTY09',paint:'PPSW',interior:'INPB0'};
  const gemini=selectArtwork({...base,wheel:'WY19B'}),induction=selectArtwork({...base,wheel:'WY20P'});
  assert.ok(gemini.port&&induction.port);
  assert.ok(Math.abs(gemini.port[0]-induction.port[0])<1);
  assert.ok(Math.abs(gemini.port[1]-induction.port[1])<3);
});

test('all cascading artwork choices resolve to an available configuration', () => {
  assert.ok(selectArtwork(DEFAULT_ARTWORK));
  let selection={...DEFAULT_ARTWORK};
  for(const model of artworkOptions(selection,'model')){
    const m=changeArtwork(selection,'model',model.value);
    for(const generation of artworkOptions(m,'generation')){
      const g=changeArtwork(m,'generation',generation.value);
      for(const trim of artworkOptions(g,'trim')){
        const t=changeArtwork(g,'trim',trim.value);
        for(const field of ['paint','interior','wheel'])for(const option of artworkOptions(t,field)){
          const changed=changeArtwork(t,field,option.value);
          assert.ok(selectArtwork(changed),JSON.stringify(changed));
          for(const parent of ARTWORK_FIELDS.slice(0,ARTWORK_FIELDS.indexOf(field)))assert.equal(changed[parent],t[parent]);
        }
      }
    }
  }
});

test('appearance validation rejects unavailable or incomplete combinations and preserves entity mappings', () => {
  const config={type:'custom:tessie-card',artwork:DEFAULT_ARTWORK,entities:{tariff:'sensor.power_tariff'}};
  assert.deepEqual(validateConfig(config).entities,config.entities);
  assert.throws(()=>validateConfig({...config,artwork:{...DEFAULT_ARTWORK,wheel:'NOT_A_WHEEL'}}),/artwork/);
  assert.throws(()=>validateConfig({...config,artwork:{model:'my'}}),/artwork/);
  assert.throws(()=>validateConfig({...config,artwork:{...DEFAULT_ARTWORK,source:'https://example.com'}}),/artwork/);
});

test('original Model Y RWD exposes the matching Long Range artwork without duplicate image data',()=>{
  const selection={model:'my',generation:'legacy2020',trim:'RWD',paint:'PPSW',interior:'INPB0',wheel:'WY19B'};
  const rwd=selectArtwork(selection),longRange=selectArtwork({...selection,trim:'MTY09'});
  assert.equal(rwd.trimLabel,'Rear-Wheel Drive');
  assert.equal(rwd.artworkAliasOf,longRange.id);
  assert.equal(rwd.image,longRange.image);
  assert.deepEqual(rwd.port,longRange.port);
  assert.ok(artworkOptions(selection,'trim').some(o=>o.value==='RWD'));
});
