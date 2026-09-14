export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
export function sequence(progress,reduced=false){
 const p=clamp(progress),turn=smooth((p-.12)/.54),settle=smooth((p-.56)/.12),info=smooth((p-.80)/.10),annotations=smooth((p-.91)/.09),overview=info*(1-smooth((p-.91)/.05));
 return {angle:reduced||turn===1?0:-90*(1-turn),spread:reduced?0:1-settle,title:1-smooth((p-.09)/.14),blur:reduced?0:1.2*(1-smooth((p-.09)/.15)),front:reduced?1:settle,info,annotations,overview,detailScale:1+.30*annotations,interactive:p>=.68&&p<.91,phase:p<.12?'Side view':p<.68?'Turning to the front':p<.80?'Front view':p<.91?'Project information':'Annotated spaces'};
}
