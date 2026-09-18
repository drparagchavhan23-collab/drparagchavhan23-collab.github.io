export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
// The drawing turns from its side to the front (to .52), rests as a drawing,
// then the project notes arrive and HOLD for about a screen (.67 to .84)
// before the annotated spaces take over.
export function sequence(progress,reduced=false){
 const p=clamp(progress),turn=smooth((p-.10)/.40),settle=smooth((p-.42)/.10),info=smooth((p-.60)/.07),annotations=smooth((p-.86)/.10),overview=info*(1-smooth((p-.84)/.05));
 return {angle:reduced||turn===1?0:-90*(1-turn),spread:reduced?0:1-settle,title:1-smooth((p-.08)/.12),blur:reduced?0:1.2*(1-smooth((p-.08)/.13)),front:reduced?1:settle,info,annotations,overview,detailScale:1+.30*annotations,interactive:p>=.52&&p<.86,phase:p<.10?'Side view':p<.52?'Turning to the front':p<.60?'Front view':p<.86?'Project information':'Annotated spaces'};
}
