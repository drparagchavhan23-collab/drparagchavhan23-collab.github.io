import {Renderer} from '../tuner/renderer.mjs';
import {validateProject} from '../tuner/model.mjs';
import {BAKED,planeLeaves,hasImage,planeRenderer} from './planes.mjs';
import {sequence,clamp} from './timeline.mjs';
import {layoutAnnotations,annotatedScale} from './integration.mjs';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:700px)');
const front=$('front'),renderer=new Renderer(front),urls=[];
// rendererReady: the live canvas renderer has its 87 layer images. Only the
// mouse-tilt front view needs it, so with baked planes it is not loaded until
// a mouse first moves over the scene — and on touch or reduced motion, never.
let project,ready=false,rendererReady=false,rendererLoading=null,intensity=0,progress=0,scrollFrame=0,motionFrame=0,motion={x:0,y:0},target={x:0,y:0};
const idle=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function normalizedProgress(){return clamp($('scroller').scrollTop/Math.max(1,$('runway').offsetHeight-$('scroller').clientHeight));}
function draw(){if(rendererReady)renderer.render(project,motion,null,false);}
function ensureRenderer(){if(!rendererLoading)rendererLoading=(async()=>{if(!project)project=validateProject(await readProject());await renderer.load(project);if(renderer.missing.length)throw Error(`${renderer.missing.length} saved images could not be loaded.`);rendererReady=true;wakeMouse();})().catch(e=>console.error(e));return rendererLoading;}
function applyScroll(){scrollFrame=0;if(!ready)return;progress=normalizedProgress();const s=sequence(progress,reduced.matches),root=$('projectDialog');root.dataset.phase=s.phase;root.dataset.angle=s.angle.toFixed(2);root.dataset.progress=progress.toFixed(3);const styles={'--angle':s.angle+'deg','--spread':s.spread,'--title':s.title,'--blur':s.blur+'px','--front':s.front,'--planes':1-s.front,'--edges':clamp(1-Math.abs(s.angle+90)/24),'--info':s.info,'--annotations':s.annotations,'--detailScale':s.detailScale,'--progress':progress,'--sceneScale':1+(annotatedScale()-1)*s.annotations,'--shift':'0%','--lift':'0%','--keep':s.annotations>=.98?0:1};for(const [k,v] of Object.entries(styles))root.style.setProperty(k,v);
 document.querySelectorAll('.floating-note').forEach((note,i)=>{const t=clamp((progress-.80-i*.015)/.07),reveal=t*t*(3-2*t)*s.overview;note.style.setProperty('--reveal',reveal);note.setAttribute('aria-hidden',reveal<.05);});
 document.querySelectorAll('.annotation').forEach((annotation,i)=>{const t=clamp((s.annotations-i*.075)/.38),reveal=t*t*(3-2*t);annotation.style.setProperty('--reveal',reveal);annotation.style.setProperty('--dash',Math.round((1-reveal)*180));annotation.setAttribute('aria-hidden',reveal<.05);});
 $('perspective').style.perspective=(2500+997500*Math.pow(Math.abs(s.angle)/90,8))+'px';
 $('titleBlock').setAttribute('aria-hidden',s.title<.05);$('projectInfo').setAttribute('aria-hidden',s.overview<.05);$('projectInfo').inert=s.overview<.05;$('spaceAnnotations').setAttribute('aria-hidden',s.annotations<.05);$('phase').textContent=s.phase;$('scrollHint').textContent=s.interactive?'Move your mouse · scroll for info ↓':s.annotations>.8?'Scroll up to revisit ↑':s.info>.8?'Scroll for annotations ↓':'Scroll to explore ↓';
 layoutAnnotations();
 if((!s.interactive||reduced.matches)&&(motion.x||motion.y)){motion={x:0,y:0};target={x:0,y:0};draw();}}
function scrollChanged(){if(!scrollFrame)scrollFrame=requestAnimationFrame(applyScroll);}
function animateMouse(){motionFrame=0;if(!$('projectDialog').open||!sequence(progress,reduced.matches).interactive)return;motion.x+=(target.x-motion.x)*.13;motion.y+=(target.y-motion.y)*.13;draw();if(Math.abs(motion.x-target.x)+Math.abs(motion.y-target.y)>.02)motionFrame=requestAnimationFrame(animateMouse);}
function wakeMouse(){if(!motionFrame)motionFrame=requestAnimationFrame(animateMouse);}
function open(){if(!ready)return;$('projectDialog').showModal();document.body.style.overflow='hidden';$('scroller').scrollTop=0;motion=target={x:0,y:0};draw();applyScroll();$('scroller').focus({preventScroll:true});}
function close(){if(window.parent!==window){window.parent.postMessage({type:'kutir:close'},location.origin);return;}location.assign('/');}
$('openProject').onclick=open;$('closeProject').onclick=close;$('projectDialog').addEventListener('cancel',e=>{e.preventDefault();close();});$('scroller').addEventListener('scroll',scrollChanged,{passive:true});window.addEventListener('resize',scrollChanged);reduced.addEventListener('change',scrollChanged);
$('backToFront').onclick=()=>$('scroller').scrollTo({top:($('runway').offsetHeight-$('scroller').clientHeight)*.72,behavior:reduced.matches?'instant':'smooth'});
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
