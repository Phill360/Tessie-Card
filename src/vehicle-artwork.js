import { ARTWORK, ARTWORK_IMAGES } from './vehicle-artwork-data.js';
export { ARTWORK, ARTWORK_IMAGES };
export const ARTWORK_FIELDS = ['model','generation','trim','paint','interior','wheel'];
export const DEFAULT_ARTWORK = {model:'m3',generation:'modern',trim:'MT370',paint:'PPSW',interior:'IPB3',wheel:'W39G'};
export function selectArtwork(selection = DEFAULT_ARTWORK) {
  return ARTWORK.find(a => ARTWORK_FIELDS.every(key => a[key] === selection[key])) || null;
}
export function artworkOptions(selection, field) {
  const index=ARTWORK_FIELDS.indexOf(field), previous=ARTWORK_FIELDS.slice(0,index);
  const matching=ARTWORK.filter(a=>previous.every(key=>a[key]===selection[key]));
  const label=field==='model'?'modelLabel':field==='generation'?'years':field+'Label';
  return [...new Map(matching.map(a=>[a[field],{value:a[field],label:a[label]}])).values()];
}
// When a parent changes, preserve compatible child choices; reset others to a
// real available configuration rather than combining unrelated option codes.
export function changeArtwork(selection, field, value) {
  const next={...selection,[field]:value};
  for(const key of ARTWORK_FIELDS.slice(ARTWORK_FIELDS.indexOf(field)+1)){
    const options=artworkOptions(next,key);
    if(!options.some(o=>o.value===next[key]))next[key]=options[0]?.value;
  }
  return next;
}
export function artworkSelection(entry) {
  return Object.fromEntries(ARTWORK_FIELDS.map(key=>[key,entry[key]]));
}
