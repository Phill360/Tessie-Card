// Ignore isolated compositor pixels by measuring the largest opaque component.
// The operation is independent of body paint, wheel colour and canvas padding.
export function vehicleBounds(data, width, height, channels=4, threshold=192) {
  const count=width*height, seen=new Uint8Array(count), queue=new Uint32Array(count);
  let largest=null;
  for(let seed=0;seed<count;seed++){
    if(seen[seed]||data[seed*channels+channels-1]<threshold)continue;
    let head=0,tail=1,minX=width,minY=height,maxX=0,maxY=0;
    queue[0]=seed;seen[seed]=1;
    while(head<tail){
      const p=queue[head++],x=p%width,y=Math.floor(p/width);
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      const visit=n=>{if(!seen[n]&&data[n*channels+channels-1]>=threshold){seen[n]=1;queue[tail++]=n;}};
      if(x)visit(p-1);if(x+1<width)visit(p+1);if(y)visit(p-width);if(y+1<height)visit(p+width);
    }
    if(!largest||tail>largest.pixels)largest={left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1,pixels:tail};
  }
  if(!largest||largest.pixels<count*.01)throw Error('No usable vehicle silhouette');
  return largest;
}

export function vehicleTransform(bounds, layout) {
  const scale=layout.width/bounds.width;
  return {scale,offsetX:layout.left-bounds.left*scale,offsetY:layout.top-bounds.top*scale,
    body:{left:layout.left,top:layout.top,width:layout.width,height:bounds.height*scale}};
}

export function transformPort(bounds, transform, fraction) {
  if(!fraction)return null;
  const source=[bounds.left+fraction[0]*bounds.width,bounds.top+fraction[1]*bounds.height];
  return source.map((v,i)=>Math.round((v*transform.scale+(i?transform.offsetY:transform.offsetX))*100)/100);
}
