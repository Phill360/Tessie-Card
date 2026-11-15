import test from 'node:test';
import assert from 'node:assert/strict';
import { vehicleBounds, vehicleTransform, transformPort } from '../scripts/lib/vehicle-geometry.mjs';

test('isolated opaque pixels and faint shadows do not shrink the vehicle',()=>{
  const width=100,height=80,data=Buffer.alloc(width*height*4);
  for(let y=10;y<45;y++)for(let x=20;x<80;x++)data[(y*width+x)*4+3]=255;
  for(const [x,y] of [[1,1],[98,78],[0,79]])data[(y*width+x)*4+3]=255;
  for(let y=45;y<55;y++)for(let x=10;x<90;x++)data[(y*width+x)*4+3]=100;
  assert.deepEqual(vehicleBounds(data,width,height),{left:20,top:10,width:60,height:35,pixels:2100});
});

test('uniform framing and port projection survive different source padding and scale',()=>{
  const layout={left:83,top:67,width:836};
  const original={left:10,top:20,width:400,height:200};
  const padded={left:120,top:90,width:800,height:400};
  const a=vehicleTransform(original,layout),b=vehicleTransform(padded,layout);
  assert.deepEqual(a.body,b.body);
  assert.deepEqual(transformPort(original,a,[.68,.31]),transformPort(padded,b,[.68,.31]));
  assert.equal(a.body.width/a.body.height,original.width/original.height);
  assert.equal(transformPort(original,a,null),null);
});

test('empty or tiny isolated artifacts cannot become a prepared car',()=>{
  assert.throws(()=>vehicleBounds(Buffer.alloc(100*100*4),100,100),/silhouette/);
  const data=Buffer.alloc(100*100*4);data[3]=255;
  assert.throws(()=>vehicleBounds(data,100,100),/silhouette/);
});
