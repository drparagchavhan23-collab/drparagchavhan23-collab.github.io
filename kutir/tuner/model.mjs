export const VERSION=1;
export const BLENDS=['source-over','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'];
export const uid=()=>globalThis.crypto.randomUUID();
export const clone=v=>JSON.parse(JSON.stringify(v));
export function node(kind='image',name='Layer',asset=null){return {id:uid(),kind,name,asset,visible:true,locked:false,opacity:1,blend:'source-over',clip:false,x:0,y:0,scale:1,rotation:0,depth:0,adjust:{brightness:100,contrast:100,saturation:100,hue:0,blur:0},mask:{enabled:true,inverted:false,strokes:[]},paint:[],...(kind==='group'?{children:[],collapsed:false}:{})};}
export function createProject(records){return {version:VERSION,id:uid(),name:'Residence',updatedAt:new Date().toISOString(),width:1400,height:700,settings:{intensity:12,background:'checker',referenceOpacity:0,reference:null},assets:{},layers:records.map((r,i)=>{const n=node('image',r.file.replace(/^secspread_(?:\d+s?_)+/,'').replace(/\.png$/,''),'../layer-'+String(i).padStart(3,'0')+'.png');n.source=r.file;n.depth=r.file.includes('_0002s_')?.9:r.file.includes('_0003s_')?.65:.25;return n;})};}
export function flatten(layers,parents=[]){return layers.flatMap(n=>[{node:n,parents},...(n.children?flatten(n.children,[...parents,n]):[])]);}
export function locate(p,id,layers=p.layers,parents=[]){for(let i=0;i<layers.length;i++){const n=layers[i];if(n.id===id)return {node:n,list:layers,index:i,parents};if(n.children){const found=locate(p,id,n.children,[...parents,n]);if(found)return found;}}return null;}
export function locked(p,id){const r=locate(p,id);return !r||r.node.locked||r.parents.some(n=>n.locked);}
export function selectedRoots(p,ids){const set=new Set(ids);return flatten(p.layers).filter(r=>set.has(r.node.id)&&!r.parents.some(n=>set.has(n.id))).map(r=>r.node);}
export function moveLayers(p,ids,targetId,position='before'){
 const roots=selectedRoots(p,ids),target=locate(p,targetId);if(!target||!roots.length)throw Error('Choose layers and a destination.');
 if(roots.some(n=>locked(p,n.id))||locked(p,targetId))throw Error('A layer or parent group is locked.');
 for(const n of roots)if(n.id===targetId||flatten(n.children||[]).some(r=>r.node.id===targetId))throw Error('Cannot move a group into itself or its descendant.');
 if(position==='inside'&&!target.node.children)throw Error('Drop inside a group.');
 for(const n of roots){const r=locate(p,n.id);r.list.splice(r.index,1);}
 const t=locate(p,targetId);if(position==='inside')t.node.children.unshift(...roots);else t.list.splice(t.index+(position==='after'?1:0),0,...roots);
}
export function groupLayers(p,ids){const roots=selectedRoots(p,ids);if(!roots.length)throw Error('Select one or more layers.');const locations=roots.map(n=>locate(p,n.id));if(locations.some(r=>locked(p,r.node.id)))throw Error('A layer is locked.');if(locations.some(r=>r.list!==locations[0].list))throw Error('Group layers in the same parent first.');const list=locations[0].list,at=Math.min(...locations.map(r=>r.index)),g=node('group','New group');g.children=roots;for(const n of roots)list.splice(list.indexOf(n),1);list.splice(at,0,g);return g;}
export function ungroup(p,id){const r=locate(p,id);if(!r?.node.children)throw Error('Select a group.');const n=r.node;if(locked(p,id))throw Error('Group is locked.');if(n.opacity!==1||n.x||n.y||n.rotation||n.scale!==1||n.depth||n.blend!=='source-over'||n.clip||n.mask.strokes.length||n.mask.inverted||n.paint.length||!n.visible||Object.entries(n.adjust).some(([k,v])=>v!==({brightness:100,contrast:100,saturation:100,hue:0,blur:0})[k]))throw Error('To preserve appearance, reset group effects and transforms before ungrouping.');r.list.splice(r.index,1,...n.children);}
export function duplicate(p,ids){const copies=[];for(const original of selectedRoots(p,ids)){const r=locate(p,original.id);if(locked(p,original.id))throw Error('Layer is locked.');const c=clone(original);for(const {node:n} of flatten([c]))n.id=uid();c.name+=' copy';r.list.splice(r.index,0,c);copies.push(c.id);}return copies;}
export function validateProject(p){
 if(!p||p.version!==VERSION)throw Error('Unsupported project version. Your existing project was not changed.');
 if(p.width!==1400||p.height!==700||!Array.isArray(p.layers)||typeof p.name!=='string'||typeof p.id!=='string'||!Number.isFinite(Date.parse(p.updatedAt)))throw Error('Invalid project structure.');
 if(!p.settings||!p.assets||Array.isArray(p.assets)||typeof p.assets!=='object')throw Error('Missing project settings or assets.');
 const ids=new Set();let count=0;
 const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const asset=v=>v===null||typeof v==='string'&&(/^\.\.\/layer-\d{3}\.png$/.test(v)||/^data:image\/(png|jpeg|webp);base64,/.test(v)||/^asset:[\w-]+$/.test(v));
 const strokes=s=>{if(!Array.isArray(s)||s.length>10000)throw Error('Invalid brush strokes.');for(const t of s){if(!number(t.size,1,1000)||!number(t.opacity,0,1)||!Array.isArray(t.points)||t.points.length>100000||!t.points.length||t.points.some(pt=>!Array.isArray(pt)||pt.length!==2||pt.some(v=>!number(v,-100000,100000))))throw Error('Invalid brush stroke.');if(t.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(t.color))throw Error('Invalid paint color.');}};
 const walk=(list,depth)=>{if(depth>20)throw Error('Too many nested groups.');for(const n of list){if(++count>1000)throw Error('Too many layers.');if(!n||typeof n.id!=='string'||ids.has(n.id))throw Error('Duplicate or missing layer ID.');ids.add(n.id);if(!['image','paint','group','adjustment'].includes(n.kind)||typeof n.name!=='string'||!BLENDS.includes(n.blend)||!asset(n.asset))throw Error('Invalid layer.');for(const [key,min,max] of [['x',-100000,100000],['y',-100000,100000],['scale',.01,100],['rotation',-36000,36000],['depth',-10,10],['opacity',0,1]])if(!number(n[key],min,max))throw Error('Invalid '+key);if(!n.adjust||!n.mask)throw Error('Missing layer effects.');for(const [k,min,max] of [['brightness',0,400],['contrast',0,400],['saturation',0,400],['hue',-360,360],['blur',0,50]])if(!number(n.adjust[k],min,max))throw Error('Invalid adjustment.');strokes(n.paint);strokes(n.mask.strokes);if(n.kind==='group'){if(!Array.isArray(n.children))throw Error('Invalid group.');walk(n.children,depth+1);}}};walk(p.layers,0);
 for(const [k,v] of Object.entries(p.assets))if(!/^asset:[\w-]+$/.test(k)||!asset(v)||!v.startsWith('data:'))throw Error('Invalid embedded asset.');
 for(const {node:n} of flatten(p.layers))if(n.asset?.startsWith('asset:')&&!p.assets[n.asset])throw Error('Missing embedded image.');
 if(!number(p.settings.intensity,0,100)||!number(p.settings.referenceOpacity,0,1)||!['checker','white','dark'].includes(p.settings.background)||!asset(p.settings.reference))throw Error('Invalid view settings.');
 return p;
}
