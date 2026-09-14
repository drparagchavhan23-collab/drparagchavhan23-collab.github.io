import {Renderer,canvas,W,H} from '../tuner/renderer.mjs';
import {flatten,validateProject} from '../tuner/model.mjs';
import {sequence,clamp} from './timeline.mjs';
import {layoutAnnotations} from './integration.mjs';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:700px)');
const front=$('front'),renderer=new Renderer(front),urls=[];
let project,ready=false,progress=0,scrollFrame=0,motionFrame=0,motion={x:0,y:0},target={x:0,y:0};
const idle=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function normalizedProgress(){return clamp($('scroller').scrollTop/Math.max(1,$('runway').offsetHeight-$('scroller').clientHeight));}
function draw(){renderer.render(project,motion,null,false);}
function applyScroll(){scrollFrame=0;if(!ready)return;progress=normalizedProgress();const s=sequence(progress,reduced.matches),root=$('projectDialog');root.dataset.phase=s.phase;root.dataset.angle=s.angle.toFixed(2);root.dataset.progress=progress.toFixed(3);const styles={'--angle':s.angle+'deg','--spread':s.spread,'--title':s.title,'--blur':s.blur+'px','--front':s.front,'--planes':1-s.front,'--edges':clamp(1-Math.abs(s.angle+90)/24),'--info':s.info,'--annotations':s.annotations,'--detailScale':s.detailScale,'--progress':progress,'--sceneScale':s.detailScale,'--shift':'0%','--lift':'0%'};for(const [k,v] of Object.entries(styles))root.style.setProperty(k,v);
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
$('scene').addEventListener('pointermove',e=>{if(reduced.matches||e.pointerType==='touch'||!sequence(progress).interactive)return;const r=$('perspective').getBoundingClientRect();target={x:clamp((e.clientX-r.left)/r.width*2-1,-1,1)*project.settings.intensity,y:clamp((e.clientY-r.top)/r.height*2-1,-1,1)*project.settings.intensity*.6};wakeMouse();});$('scene').addEventListener('pointerleave',()=>{target={x:0,y:0};wakeMouse();});
async function buildPlanes(){
 const leaves=flatten(project.layers).filter(r=>r.node.kind!=='group'),world=$('world'),isolate=canvas(),small=document.createElement('canvas');small.width=840;small.height=420;
 for(let i=leaves.length-1;i>=0;i--){const {node:n,parents}=leaves[i],plane=document.createElement('div');plane.className='plane';plane.dataset.layer=n.name;plane.style.setProperty('--z',((leaves.length-1)/2-i)*Math.min(5,Math.max(2,innerWidth*.48/leaves.length)));const edge=document.createElement('i');edge.className='edge';plane.append(edge);
 if(n.visible&&parents.every(p=>p.visible)&&n.kind!=='adjustment'){
 const x=isolate.getContext('2d');x.resetTransform();x.globalAlpha=1;x.globalCompositeOperation='source-over';x.clearRect(0,0,W,H);x.save();for(const parent of parents)renderer.apply(x,parent,{x:0,y:0});x.globalAlpha=n.opacity*parents.reduce((a,p)=>a*p.opacity,1);renderer.used=0;renderer.drawNode(x,n,{x:0,y:0},null,parents.map(p=>p.id));x.restore();
 const sx=small.getContext('2d');sx.clearRect(0,0,small.width,small.height);sx.drawImage(isolate,0,0,small.width,small.height);const blob=await new Promise(resolve=>small.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not prepare layer '+n.name);const url=URL.createObjectURL(blob);urls.push(url);const im=new Image();im.alt='';im.src=url;await im.decode();plane.prepend(im);}
 world.append(plane);if(i%8===0){$('loadStatus').textContent=`Preparing the side view · ${leaves.length-i} / ${leaves.length} layers`;await idle();}}
 world.dataset.count=leaves.length;return leaves.length;
}
async function readProject(){const response=await fetch('/projects/kutir-project.json');if(!response.ok)throw Error('The saved arrangement is not available.');const saved=await response.json();return {...saved,name:'KUTIR'};}
async function init(){try{const saved=await readProject();if(!saved)throw Error('Save your arrangement in the tuner first.');project=validateProject(saved);await renderer.load(project);if(renderer.missing.length)throw Error(`${renderer.missing.length} saved images could not be loaded.`);draw();$('cover').getContext('2d').drawImage(front,0,0);$('projectTitle').textContent=project.name;$('navTitle').textContent=project.name;document.querySelector('.project-entry h1').textContent=project.name;document.title=project.name+' — project presentation';const count=await buildPlanes();ready=true;$('openProject').disabled=false;$('loadStatus').textContent=`${count} layers · saved arrangement loaded · click to explore`;
 if(location.hash==='#project')open();
 }catch(e){$('loadStatus').textContent=e.message;$('loadStatus').style.color='#a12a20';console.error(e);}}
window.addEventListener('pagehide',()=>{for(const u of urls)URL.revokeObjectURL(u);});init();
