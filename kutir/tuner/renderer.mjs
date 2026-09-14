import {flatten} from './model.mjs';
export const W=1400,H=700;
export function canvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
export function brush(ctx,s,mask=false){ctx.save();ctx.globalAlpha=s.opacity;ctx.globalCompositeOperation=s.erase?'destination-out':'source-over';ctx.fillStyle=ctx.strokeStyle=mask?'#fff':s.color;ctx.lineWidth=s.size;ctx.lineCap=ctx.lineJoin='round';if(s.softness)ctx.filter=`blur(${s.softness}px)`;ctx.beginPath();const p=s.points;ctx.moveTo(...p[0]);for(const q of p.slice(1))ctx.lineTo(...q);if(p.length===1){ctx.arc(p[0][0],p[0][1],s.size/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();ctx.restore();}
export function filter(a){return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%) hue-rotate(${a.hue}deg) blur(${a.blur}px)`;}
export class Renderer{
 constructor(output){this.output=output;this.images=new Map();this.cache=new Map();this.pool=[];this.used=0;this.missing=[];}
 scratch(){const c=this.pool[this.used]??(this.pool[this.used]=canvas());this.used++;const x=c.getContext('2d');x.resetTransform();x.globalAlpha=1;x.globalCompositeOperation='source-over';x.filter='none';x.clearRect(0,0,W,H);return c;}
 async load(p){this.missing=[];const sources=[...new Set(flatten(p.layers).map(r=>r.node.asset).concat([p.settings.reference]).filter(Boolean))];await Promise.all(sources.map(async key=>{const src=p.assets[key]||key.replace(/^\.\.\/layer-(\d{3})\.png$/, '/projects/kutir-layer-$1.png');if(this.images.get(key)?.src===src||this.images.get(key)?.getAttribute('src')===src)return;const image=new Image();image.src=src;try{await image.decode();this.images.set(key,image);}catch{this.missing.push(key);}}));this.cache.clear();}
 mask(n){const c=canvas(),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);for(const s of n.mask.strokes)brush(x,s,true);if(n.mask.inverted){const inverse=canvas(),ix=inverse.getContext('2d');ix.fillStyle='#fff';ix.fillRect(0,0,W,H);ix.globalCompositeOperation='destination-out';ix.drawImage(c,0,0);return inverse;}return c;}
 content(n){const image=n.asset?this.images.get(n.asset):null;const hasMask=n.mask.enabled&&(n.mask.strokes.length||n.mask.inverted);const effects=n.paint.length||hasMask||n.adjust.brightness!==100||n.adjust.contrast!==100||n.adjust.saturation!==100||n.adjust.hue||n.adjust.blur;
 if(!effects)return image;
 const key=JSON.stringify([n.asset,n.paint,n.mask,n.adjust]);const cached=this.cache.get(n.id);if(cached?.key===key)return cached.canvas;
 const c=canvas(),x=c.getContext('2d');if(image)x.drawImage(image,0,0,W,H);for(const s of n.paint)brush(x,s);if(hasMask){x.globalCompositeOperation='destination-in';x.drawImage(this.mask(n),0,0);x.globalCompositeOperation='source-over';}
 const adjusted=canvas(),a=adjusted.getContext('2d');a.filter=filter(n.adjust);a.drawImage(c,0,0);this.cache.set(n.id,{key,canvas:adjusted});return adjusted;
 }
 matrix(n,motion){const dx=n.x+motion.x*n.depth,dy=n.y+motion.y*n.depth;return new DOMMatrix().translate(W/2+dx,H/2+dy).rotate(n.rotation).scale(n.scale).translate(-W/2,-H/2);}
 apply(ctx,n,motion){const m=this.matrix(n,motion);ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);}
 drawNode(ctx,n,motion,solo,ancestors=[]){ctx.save();this.apply(ctx,n,motion);
 if(n.children){const mark=this.used,c=this.scratch();this.renderList(c.getContext('2d'),n.children,motion,solo,[...ancestors,n.id]);if(n.mask.enabled&&(n.mask.strokes.length||n.mask.inverted)){const x=c.getContext('2d');x.globalCompositeOperation='destination-in';x.drawImage(this.mask(n),0,0);x.globalCompositeOperation='source-over';}ctx.filter=filter(n.adjust);ctx.drawImage(c,0,0);this.used=mark;}
 else{const image=this.content(n);if(image)ctx.drawImage(image,0,0,W,H);}ctx.restore();}
 renderList(ctx,list,motion,solo,ancestors=[]){let base=null;for(let i=list.length-1;i>=0;i--){const n=list[i];const soloAllowed=!solo||n.id===solo||ancestors.includes(solo)||flatten(n.children||[]).some(r=>r.node.id===solo);if(!n.visible||!soloAllowed){if(!n.clip)base=null;continue;}
 if(n.kind==='adjustment'){const mark=this.used,c=this.scratch(),x=c.getContext('2d');x.filter=filter(n.adjust);x.drawImage(ctx.canvas,0,0);if(n.mask.enabled&&(n.mask.strokes.length||n.mask.inverted)){x.filter='none';x.globalCompositeOperation='destination-in';x.drawImage(this.mask(n),0,0);}ctx.save();ctx.globalAlpha=n.opacity;ctx.globalCompositeOperation='source-atop';ctx.drawImage(c,0,0);ctx.restore();this.used=mark;continue;}
 ctx.save();ctx.globalAlpha=n.opacity;ctx.globalCompositeOperation=n.blend;
 if(n.clip){if(base){const mark=this.used,c=this.scratch(),x=c.getContext('2d');this.drawNode(x,n,motion,solo,ancestors);const b=this.scratch(),bx=b.getContext('2d');bx.globalAlpha=base.opacity;this.drawNode(bx,base,motion,solo,ancestors);x.globalCompositeOperation='destination-in';x.drawImage(b,0,0);ctx.drawImage(c,0,0);this.used=mark;}}
 else{this.drawNode(ctx,n,motion,solo,ancestors);base=n;}ctx.restore();}}
 render(p,motion={x:0,y:0},solo=null,reference=true){this.used=0;const x=this.output.getContext('2d');x.clearRect(0,0,W,H);this.renderList(x,p.layers,motion,solo);if(reference&&p.settings.referenceOpacity&&this.images.has(p.settings.reference)){x.save();x.globalAlpha=p.settings.referenceOpacity;x.drawImage(this.images.get(p.settings.reference),0,0,W,H);x.restore();}}
 world(p,id,motion={x:0,y:0}){const r=flatten(p.layers).find(r=>r.node.id===id);let m=new DOMMatrix();for(const n of [...r.parents,r.node])m=m.multiply(this.matrix(n,motion));return m;}
}
