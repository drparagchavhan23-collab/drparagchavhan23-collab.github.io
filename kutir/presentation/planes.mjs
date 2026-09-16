import {canvas,W,H} from '../tuner/renderer.mjs';
import {flatten} from '../tuner/model.mjs';

// One layer of the side view, drawn on its own. Shared by the live fallback in
// presentation.mjs and by scripts/bake-kutir.html, which renders every layer
// once ahead of time — so a baked plane is, by construction, the same picture
// the browser would have drawn.

export const PLANE_W=840,PLANE_H=420;
export const BAKED='/projects/kutir-baked/';

export function planeLeaves(project){return flatten(project.layers).filter(r=>r.node.kind!=='group');}
export function hasImage({node:n,parents}){return n.visible&&parents.every(p=>p.visible)&&n.kind!=='adjustment';}

/** Returns a function that draws one leaf into a PLANE_W×PLANE_H canvas (reused between calls). */
export function planeRenderer(renderer){
 const isolate=canvas(),small=document.createElement('canvas');small.width=PLANE_W;small.height=PLANE_H;
 return ({node:n,parents})=>{
  const x=isolate.getContext('2d');x.resetTransform();x.globalAlpha=1;x.globalCompositeOperation='source-over';x.clearRect(0,0,W,H);x.save();for(const parent of parents)renderer.apply(x,parent,{x:0,y:0});x.globalAlpha=n.opacity*parents.reduce((a,p)=>a*p.opacity,1);renderer.used=0;renderer.drawNode(x,n,{x:0,y:0},null,parents.map(p=>p.id));x.restore();
  const sx=small.getContext('2d');sx.clearRect(0,0,PLANE_W,PLANE_H);sx.drawImage(isolate,0,0,PLANE_W,PLANE_H);
  return small;
 };
}

/**
 * The saved arrangement's identity, independent of formatting and line endings:
 * the bake records it, and a test compares it against the arrangement on disk,
 * so a tuner save that isn't re-baked fails the test suite instead of quietly
 * shipping planes that no longer match.
 */
export async function arrangementSignature(text){
 const canonical=new TextEncoder().encode(JSON.stringify(JSON.parse(text)));
 const digest=await crypto.subtle.digest('SHA-256',canonical);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
