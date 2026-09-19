import {Renderer} from '../tuner/renderer.mjs';
import {validateProject} from '../tuner/model.mjs';
import {BAKED,planeLeaves,hasImage,planeRenderer} from './planes.mjs';
import {sequence,clamp} from './timeline.mjs';
import {layoutAnnotations,annotatedScale} from './integration.mjs';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)'),canHover=matchMedia('(hover: hover) and (pointer: fine)'),mobile=matchMedia('(max-width:700px)');
const front=$('front'),renderer=new Renderer(front),urls=[];
// rendererReady: the live canvas renderer has its 87 layer images. Only the
// mouse-tilt front view needs it, so with baked planes it is not loaded until
// a mouse first moves over the scene — and on touch or reduced motion, never.
let project,ready=false,rendererReady=false,rendererLoading=null,intensity=0,progress=0,scrollFrame=0,motionFrame=0,motion={x:0,y:0},target={x:0,y:0};
const idle=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function normalizedProgress(){return clamp($('scroller').scrollTop/Math.max(1,$('runway').offsetHeight-$('scroller').clientHeight));}
function draw(){if(rendererReady)renderer.render(project,motion,null,false);}
function ensureRenderer(){if(!rendererLoading)rendererLoading=(async()=>{if(!project)project=validateProject(await readProject());await renderer.load(project);if(renderer.missing.length)throw Error(`${renderer.missing.length} saved images could not be loaded.`);rendererReady=true;wakeMouse();})().catch(e=>console.error(e));return rendererLoading;}
// Each value is written only onto the element that reads it, and only when it
// changes. Set on the dialog, a variable restyles all 88 drawing layers under
// it on every frame of the scroll; set on #world it restyles them only while
// the drawing is actually turning.
const written=new Map();
function put(el,name,value){if(!el)return;let seen=written.get(el);if(!seen)written.set(el,seen={});if(seen[name]===value)return;seen[name]=value;if(name.startsWith('--'))el.style.setProperty(name,value);else el.style[name]=value;}
function putData(el,name,value){if(el.dataset[name]!==value)el.dataset[name]=value;}
let annotationsShown=false;
function applyScroll(){scrollFrame=0;if(!ready)return;progress=normalizedProgress();const s=sequence(progress,reduced.matches),root=$('projectDialog');putData(root,'phase',s.phase);putData(root,'angle',s.angle.toFixed(2));putData(root,'progress',progress.toFixed(3));
 const r=(v,d=4)=>String(+v.toFixed(d));
 const world=$('world');put(world,'--angle',r(s.angle,2)+'deg');put(world,'--spread',r(s.spread));put(world,'--planes',r(1-s.front));put(world,'--edges',r(clamp(1-Math.abs(s.angle+90)/24)));
 // The scene's zoom and blur go straight onto its own style: as variables on
 // #scene they would reach every layer inside it.
 const sceneScale=1+(annotatedScale()-1)*s.annotations+(mobile.matches?0:.12*s.overview);
 put($('scene'),'transform',mobile.matches?`translateY(${r(-15*s.annotations-24*s.overview,3)}vh) scale(${r(sceneScale)})`:`translate(${r(s.overview*16,3)}vw, 0%) scale(${r(sceneScale)})`);
 put($('scene'),'filter',s.blur>0.001?`blur(${r(s.blur,3)}px)`:'none');
 put($('titleBlock'),'--title',r(s.title));put($('front'),'--front',r(s.front));put($('projectInfo'),'--info',r(s.info));put($('backToFront'),'--overview',r(s.overview));
 put($('spaceAnnotations'),'--annotations',r(s.annotations));put($('spaceAnnotations'),'--detailScale',r(s.detailScale));put($('mobileLegend'),'--annotations',r(s.annotations));
 put(document.querySelector('.track'),'--progress',r(progress));put($('keepScrolling'),'--keep',s.annotations>=.98?'0':'1');
 document.querySelectorAll('.floating-note').forEach((note,i)=>{const t=clamp((progress-.60-i*.02)/.07),reveal=t*t*(3-2*t)*s.overview;put(note,'--reveal',r(reveal));if(note.getAttribute('aria-hidden')!==String(reveal<.05))note.setAttribute('aria-hidden',reveal<.05);});
 document.querySelectorAll('.annotation').forEach((annotation,i)=>{const t=clamp((s.annotations-i*.075)/.38),reveal=t*t*(3-2*t);put(annotation,'--reveal',r(reveal));put(annotation,'--dash',String(Math.round((1-reveal)*180)));if(annotation.getAttribute('aria-hidden')!==String(reveal<.05))annotation.setAttribute('aria-hidden',reveal<.05);});
 put($('perspective'),'perspective',Math.round(2500+997500*Math.pow(Math.abs(s.angle)/90,8))+'px');
 const flag=(el,v)=>{if(el.getAttribute('aria-hidden')!==String(v))el.setAttribute('aria-hidden',v);};
 flag($('titleBlock'),s.title<.05);flag($('projectInfo'),s.overview<.05);if($('projectInfo').inert!==(s.overview<.05))$('projectInfo').inert=s.overview<.05;flag($('spaceAnnotations'),s.annotations<.05);
 const hint=s.interactive?(canHover.matches?'Move your mouse · scroll for info ↓':'Scroll for info ↓'):s.annotations>.8?'Scroll up to revisit ↑':s.info>.8?'Scroll for annotations ↓':'Scroll to explore ↓';
 if($('phase').textContent!==s.phase)$('phase').textContent=s.phase;if($('scrollHint').textContent!==hint)$('scrollHint').textContent=hint;
 // Measuring where the labels go forces a layout, so it only happens while they show.
 if(s.annotations>0){layoutAnnotations();annotationsShown=true;}else annotationsShown=false;
 if((!s.interactive||reduced.matches)&&(motion.x||motion.y)){motion={x:0,y:0};target={x:0,y:0};draw();}}
function scrollChanged(){if(!scrollFrame)scrollFrame=requestAnimationFrame(applyScroll);}
function animateMouse(){motionFrame=0;if(!$('projectDialog').open||!sequence(progress,reduced.matches).interactive)return;motion.x+=(target.x-motion.x)*.13;motion.y+=(target.y-motion.y)*.13;draw();if(Math.abs(motion.x-target.x)+Math.abs(motion.y-target.y)>.02)motionFrame=requestAnimationFrame(animateMouse);}
function wakeMouse(){if(!motionFrame)motionFrame=requestAnimationFrame(animateMouse);}
function open(){if(!ready)return;$('projectDialog').showModal();document.body.style.overflow='hidden';$('scroller').scrollTop=0;motion=target={x:0,y:0};draw();applyScroll();$('scroller').focus({preventScroll:true});}
function close(){if(window.parent!==window){window.parent.postMessage({type:'kutir:close'},location.origin);return;}location.assign('/');}
$('openProject').onclick=open;$('closeProject').onclick=close;$('projectDialog').addEventListener('cancel',e=>{e.preventDefault();close();});$('scroller').addEventListener('scroll',scrollChanged,{passive:true});window.addEventListener('resize',()=>{written.clear();scrollChanged();});reduced.addEventListener('change',scrollChanged);
$('backToFront').onclick=()=>$('scroller').scrollTo({top:($('runway').offsetHeight-$('scroller').clientHeight)*.56,behavior:reduced.matches?'instant':'smooth'});
$('scene').addEventListener('pointermove',e=>{if(reduced.matches||e.pointerType==='touch'||!sequence(progress).interactive)return;ensureRenderer();const r=$('perspective').getBoundingClientRect();target={x:clamp((e.clientX-r.left)/r.width*2-1,-1,1)*intensity,y:clamp((e.clientY-r.top)/r.height*2-1,-1,1)*intensity*.6};wakeMouse();});$('scene').addEventListener('pointerleave',()=>{target={x:0,y:0};wakeMouse();});
function addPlane(world,name,i,count){const plane=document.createElement('div');plane.className='plane';plane.dataset.layer=name;plane.style.setProperty('--z',((count-1)/2-i)*Math.min(5,Math.max(2,innerWidth*.48/count)));const edge=document.createElement('i');edge.className='edge';plane.append(edge);world.append(plane);return plane;}
// The fast path: every layer was drawn once ahead of time by scripts/bake-kutir.html.
// Nothing is rendered here — the side view is 88 small images and the front view
// is one — so the page is ready as soon as those arrive.
async function showBaked(manifest){
 const world=$('world'),count=manifest.planes.length,cover=new Image();cover.src=BAKED+manifest.cover;
 let done=0;const tick=()=>{done++;if(done%8===0||done===count)$('loadStatus').textContent=`Loading the side view · ${done} / ${count} layers`;};
 const pending=[cover.decode().then(()=>{front.getContext('2d').drawImage(cover,0,0,front.width,front.height);$('cover').getContext('2d').drawImage(cover,0,0,front.width,front.height);})];
 for(let i=count-1;i>=0;i--){const {name,image}=manifest.planes[i],plane=addPlane(world,name,i,count);
  if(!image){tick();continue;}
  const im=new Image();im.alt='';im.decoding='async';im.src=BAKED+image;plane.prepend(im);pending.push(im.decode().then(tick,tick));}
 await Promise.all(pending);world.dataset.count=count;return count;
}
// The fallback: no bake on disk, so draw every layer in the browser as before.
async function buildPlanes(){
 const leaves=planeLeaves(project),world=$('world'),drawPlane=planeRenderer(renderer);
 for(let i=leaves.length-1;i>=0;i--){const plane=addPlane(world,leaves[i].node.name,i,leaves.length);
 if(hasImage(leaves[i])){const small=drawPlane(leaves[i]);const blob=await new Promise(resolve=>small.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not prepare layer '+leaves[i].node.name);const url=URL.createObjectURL(blob);urls.push(url);const im=new Image();im.alt='';im.src=url;await im.decode();plane.prepend(im);}
 if(i%8===0){$('loadStatus').textContent=`Preparing the side view · ${leaves.length-i} / ${leaves.length} layers`;await idle();}}
 world.dataset.count=leaves.length;return leaves.length;
}
async function readBaked(){try{const response=await fetch(BAKED+'manifest.json');return response.ok?await response.json():null;}catch{return null;}}
async function readProject(){const response=await fetch('/projects/kutir-project.json');if(!response.ok)throw Error('The saved arrangement is not available.');const saved=await response.json();return {...saved,name:'KUTIR'};}
async function init(){try{const name='KUTIR';$('projectTitle').textContent=name;$('navTitle').textContent=name;document.querySelector('.project-entry h1').textContent=name;document.title=name+' — project presentation';
 const baked=await readBaked();let count;
 if(baked){intensity=baked.intensity;count=await showBaked(baked);}
 else{const saved=await readProject();if(!saved)throw Error('Save your arrangement in the tuner first.');project=validateProject(saved);intensity=project.settings.intensity;await renderer.load(project);if(renderer.missing.length)throw Error(`${renderer.missing.length} saved images could not be loaded.`);rendererReady=true;draw();$('cover').getContext('2d').drawImage(front,0,0);rendererLoading=Promise.resolve();count=await buildPlanes();}
 ready=true;$('openProject').disabled=false;$('loadStatus').textContent=`${count} layers · saved arrangement loaded · click to explore`;
 if(location.hash==='#project')open();
 }catch(e){$('loadStatus').textContent=e.message;$('loadStatus').style.color='#a12a20';console.error(e);}}
window.addEventListener('pagehide',()=>{for(const u of urls)URL.revokeObjectURL(u);});init();
