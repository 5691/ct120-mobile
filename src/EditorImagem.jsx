import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {useEffect,useRef,useState} from 'react';

export default function EditorImagem({onBitmap,encodeBitmap,onSelectBmp,preview,disabled,imagemParaEditar,onEditStart}){
const source=useRef(null), loadId=useRef(0), ref=useRef(null), original=useRef(null), history=useRef([]), future=useRef([]), drawing=useRef(false);const [open,S]=useState(false),[status,T]=useState(''),[pen,P]=useState(false),[size,Z]=useState(3),[zoom,Q]=useState(1),[mode,M]=useState('normal'),[brightness,B]=useState(0),[contrast,C]=useState(0),[sharp,H]=useState(0);
const [manual,setManual]=useState(false);
const [savedBmp,setSavedBmp]=useState(null);
const [savingBmp,setSavingBmp]=useState(false);
const savingBmpRef=useRef(false);
const [manualTool,setManualTool]=useState('lapis');
const [navigating,setNavigating]=useState(false);
const shapeStart=useRef(null);
 const poly=useRef(null), dragNode=useRef(-1), objects=useRef([]), vectorBase=useRef(null), moveObject=useRef(null);
 const [selectionMode,setSelectionMode]=useState(false);
 const [more,setMore]=useState(false),[grid,setGrid]=useState(false),[snapGrid,setSnapGrid]=useState(false),[multi,setMulti]=useState(false),[marked,setMarked]=useState([]);
 const groupId=useRef(0);
 function pathObject(c,o){c.beginPath();const p=o.points;if(!p.length)return;c.moveTo(...p[0]);if(o.curve&&p.length===4)c.bezierCurveTo(...p[1],...p[2],...p[3]);else p.slice(1).forEach(v=>c.lineTo(...v));if(o.closed)c.closePath();}
 function members(){const o=poly.current;return !o?[]:o.group?objects.current.filter(v=>v.group===o.group):[o];}
 function centerObject(axis){const a=members();if(!a.length)return;recordHistory();const v=a.flatMap(o=>o.points.map(p=>p[axis]));const d=(axis?ref.current.height:ref.current.width)/2-(Math.min(...v)+Math.max(...v))/2;a.forEach(o=>o.points=o.points.map(p=>p.map((x,i)=>x+(i===axis?d:0))));renderPoly();}
 function layer(front){const a=members();if(!a.length)return;recordHistory();const b=objects.current.filter(o=>!a.includes(o));objects.current=front?[...b,...a]:[...a,...b];renderPoly();}
 function groupObjects(){const a=objects.current.filter((o,i)=>marked.includes(i));if(a.length<2)return;recordHistory();const id=++groupId.current;const old=new Set(a.map(o=>o.group).filter(Boolean));objects.current.forEach(o=>{if(a.includes(o)||old.has(o.group))o.group=id;});setMarked([]);setMulti(false);poly.current=a[0];renderPoly();}
 function ungroup(){const a=members();if(!a.length)return;recordHistory();a.forEach(o=>delete o.group);renderPoly();}
 async function saveProject(){try{const d=vectorBase.current||snap();const name=prompt('Nome do projeto','desenho');if(!name)return;const filename=name.replace(/[^a-zA-Z0-9 _-]/g,'_')+'.ctdraw.json';const data=JSON.stringify({version:1,width:d.width,height:d.height,pixels:Array.from(d.data),objects:cloneObjects()});if(Capacitor.isNativePlatform()){const {uri}=await Filesystem.writeFile({path:filename,data,encoding:'utf8',directory:Directory.Cache});await Share.share({files:[uri]});}else{const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}}catch(e){setError('Erro ao salvar projeto: '+e.message);}}
 async function openProject(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>20000000)throw Error('Arquivo muito grande');const d=JSON.parse(await f.text());if(d.version!==1||!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<1||d.width>1000||d.height<1||d.height>480||!Array.isArray(d.pixels)||d.pixels.length!==d.width*d.height*4||!Array.isArray(d.objects)||d.objects.length>1000)throw Error('Projeto inválido');const a=d.objects.map(o=>{if(!Array.isArray(o.points)||o.points.length>10000||!o.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||!Number.isFinite(o.size)||o.size<1||o.size>20)throw Error('Objeto inválido');return {points:o.points,size:o.size,closed:!!o.closed,filled:!!o.filled,curve:!!o.curve,group:Number.isSafeInteger(o.group)?o.group:undefined};});const base=new ImageData(new Uint8ClampedArray(d.pixels),d.width,d.height);recordHistory();finishPoly();put(base);vectorBase.current=base;objects.current=a;groupId.current=Math.max(groupId.current,0,...a.map(o=>o.group||0));setSelectionMode(true);setMarked([]);renderPoly();setError('');}catch(e){setError('Erro ao abrir projeto: '+e.message);}}
 function importSvg(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;const url=URL.createObjectURL(f),img=new Image();img.onload=()=>{try{const c=ref.current;if(!img.width||!img.height)throw Error('SVG vazio');save();const k=Math.min(c.width/img.width,c.height/img.height,1);ctx().drawImage(img,(c.width-img.width*k)/2,(c.height-img.height*k)/2,img.width*k,img.height*k);commitPreview(snap());filter('normal',0,0,0);}catch(e){setError('Erro SVG: '+e.message);}finally{URL.revokeObjectURL(url);}};img.onerror=()=>{URL.revokeObjectURL(url);setError('SVG inválido');};img.src=url;}

 const [nodes,setNodes]=useState([]), [objectCount,setObjectCount]=useState(0), [selected,setSelected]=useState(-1);
 const cloneObjects=()=>objects.current.map(o=>({...o,points:o.points.map(p=>[...p])}));
 function renderPoly(){
   if(vectorBase.current){const c=ctx();c.putImageData(vectorBase.current,0,0);c.save();c.strokeStyle='black';c.fillStyle='black';c.lineJoin='round';c.lineCap='round';
   for(const p of objects.current){if(p.points.length<2)continue;c.lineWidth=p.size;pathObject(c,p);if(p.filled)c.fill();c.stroke();}c.restore();}
   setNodes(poly.current?.points.map(v=>[...v])||[]);setObjectCount(objects.current.length);setSelected(objects.current.indexOf(poly.current));commitPreview(snap());report();
 }
 function finishPoly(){setMarked([]);poly.current=null;dragNode.current=-1;moveObject.current=null;setNodes([]);setSelected(-1);}
 function flattenPoly(){finishPoly();objects.current=[];vectorBase.current=null;setObjectCount(0);}
 function selectObject(i){poly.current=objects.current[i]||null;dragNode.current=-1;renderPoly();}
 function hitObject(o,p,r,c){
 const x=ctx();x.save();pathObject(x,o);x.lineWidth=o.size+20*c.width/r.width;const hit=x.isPointInStroke(...p)||(o.closed&&x.isPointInPath(...p));x.restore();return hit;
 }
 function adjustObject(scale,angle){const o=poly.current;if(!o)return;recordHistory();const xs=o.points.map(p=>p[0]),ys=o.points.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2; o.points=o.points.map(([x,y])=>[cx+scale*((x-cx)*Math.cos(angle)-(y-cy)*Math.sin(angle)),cy+scale*((x-cx)*Math.sin(angle)+(y-cy)*Math.cos(angle))]);renderPoly();}
 function polyDown(e){
   const c=ref.current,r=c.getBoundingClientRect();const p=point(e).map((v,i)=>Math.max(0,Math.min(i?c.height-1:c.width-1,v)));
   if(selectionMode){
 const o=poly.current;const hit=o?.points.findIndex(([x,y],i)=>(o.points.length!==64||i%8===0)&&Math.hypot((x-p[0])*r.width/c.width,(y-p[1])*r.height/c.height)<12)??-1;
 if(hit>=0){recordHistory();dragNode.current=hit;e.currentTarget.setPointerCapture(e.pointerId);return;}
 let i=objects.current.length-1;while(i>=0&&!hitObject(objects.current[i],p,r,c))i--;selectObject(i);if(multi){if(i>=0)setMarked(a=>a.includes(i)?a.filter(v=>v!==i):[...a,i]);return;}if(i>=0){recordHistory();moveObject.current={start:p,items:members().map(o=>({o,points:o.points.map(v=>[...v])}))};e.currentTarget.setPointerCapture(e.pointerId);}return;
 }
 if(!poly.current){recordHistory();if(!vectorBase.current)vectorBase.current=snap();poly.current={points:[],size,closed:false,filled:false,curve:manualTool==='bezier'};objects.current.push(poly.current);}
   const obj=poly.current;const hit=obj.points.findIndex(([x,y])=>Math.hypot((x-p[0])*r.width/c.width,(y-p[1])*r.height/c.height)<12);
   if(hit>=0){recordHistory();dragNode.current=hit;e.currentTarget.setPointerCapture(e.pointerId);return;}
   if((obj.curve&&obj.points.length>=4)||obj.closed||manualTool==='selectPoly')return; if(obj.points.length)recordHistory();obj.points.push(p);renderPoly();
 }
 function polyMove(e){if(moveObject.current&&poly.current){const p=point(e),m=moveObject.current;m.items.forEach(({o,points})=>o.points=points.map(([x,y])=>[x+p[0]-m.start[0],y+p[1]-m.start[1]]));renderPoly();return;}if(!poly.current||dragNode.current<0)return;const c=ref.current;poly.current.points[dragNode.current]=point(e).map((v,i)=>Math.max(0,Math.min(i?c.height-1:c.width-1,v)));renderPoly();}
 function polyClose(filled){const p=poly.current;if(!p||p.points.length<3)return;recordHistory();p.closed=true;p.filled=filled;renderPoly();}
 function polyRemove(){const p=poly.current;if(!p)return;recordHistory();p.points.pop();if(p.points.length<3){p.closed=false;p.filled=false;}if(!p.points.length){objects.current=objects.current.filter(o=>o!==p);poly.current=null;}renderPoly();}
 function deleteObject(){if(!poly.current)return;recordHistory();objects.current=objects.current.filter(o=>!members().includes(o));poly.current=null;renderPoly();}
 function duplicateObject(){if(!poly.current)return;recordHistory();const p=poly.current,c=ref.current;poly.current={...p,group:undefined,points:p.points.map(([x,y])=>[Math.min(c.width-1,x+8),Math.min(c.height-1,y+8)])};objects.current.push(poly.current);renderPoly();}
 const editRequest=useRef(null);
const [bitmapName,setBitmapName]=useState('');
useEffect(()=>{
  if(!imagemParaEditar||editRequest.current===imagemParaEditar)return;
  editRequest.current=imagemParaEditar;
  decode(imagemParaEditar.preview,undefined,false,imagemParaEditar.nome);
  onEditStart();
});

const [tools,showTools]=useState(false),[favorites,showFavorites]=useState(false),[error,setError]=useState('');
const [crop,K]=useState(false),[fill,F]=useState(false),[erase,E]=useState(false),[compare,V]=useState(false),[fav,U]=useState(()=>{try{return JSON.parse(localStorage.getItem("ctdestroyer-favoritos")||"[]")}catch{return []}});const start=useRef(null);
const ctx=()=>ref.current.getContext('2d',{willReadFrequently:true});const snap=()=>ctx().getImageData(0,0,ref.current.width,ref.current.height);function put(d){ref.current.width=d.width;ref.current.height=d.height;ctx().putImageData(d,0,0);report()}function report(){const d=snap();setDimensions({width:d.width,height:d.height});let n=0;for(let i=0;i<d.data.length;i+=4)if(d.data[i]<128)n++;T(`${d.width} × ${d.height} px • Preto: ${(100*n/(d.width*d.height)).toFixed(1)}%`)}function commitPreview(image){source.current=image;M("normal");B(0);C(0);H(0)}
const resizeReference=useRef(null);
const sliderActive=useRef(false);
const [dimensions,setDimensions]=useState({width:1,height:1});
function capture(){return {image:snap(),source:source.current,mode,brightness,contrast,sharp,resizeReference:resizeReference.current,objects:cloneObjects(),vectorBase:vectorBase.current}}
function restore(state){resizeReference.current=state.resizeReference||null;source.current=state.source;M(state.mode);B(state.brightness);C(state.contrast);H(state.sharp);put(state.image);objects.current=state.objects||[];vectorBase.current=state.vectorBase||null;finishPoly();setObjectCount(objects.current.length)}
function recordHistory(){history.current.push(capture());resizeReference.current=null;if(history.current.length>20)history.current.shift();future.current=[]}
function save(){recordHistory();flattenPoly();}
function undo(){finishPoly();if(history.current.length){future.current.push(capture());restore(history.current.pop())}}
function redo(){finishPoly();if(future.current.length){history.current.push(capture());restore(future.current.pop())}}
function init(img, draw=false, name=''){
 flattenPoly();
  const c=ref.current;
  const scale=img?Math.min(1000/img.width,480/img.height,1):1;
  c.width=img?Math.max(1,Math.round(img.width*scale)):480;
  c.height=img?Math.max(1,Math.round(img.height*scale)):240;
  ctx().fillStyle='white';
  ctx().fillRect(0,0,c.width,c.height);
  if(img)ctx().drawImage(img,0,0,c.width,c.height);
  resizeReference.current=null;
  original.current=snap();
  source.current=original.current;
  history.current=[];
  future.current=[];
  drawing.current=false;
  start.current=null;
  M('normal'); B(0); C(0); H(0); Q(1);
  setMore(false);setGrid(false);setSnapGrid(false);setMulti(false);setMarked([]);setSelectionMode(false);setBitmapName(name); setManual(draw); setManualTool('lapis'); setNavigating(false); shapeStart.current=null; Z(3);
  P(draw); K(false); F(false); E(false); V(false); showTools(false);
  setError('');
  filter('normal',0,0,0);
  S(true);
}
function decode(url,release=()=>{},draw=false,name=''){
  const id=++loadId.current;
  const image=new Image();
  image.onload=()=>{
    try{if(id===loadId.current&&ref.current)init(image,draw,name);}
    catch{setError('Não foi possível preparar a imagem.');}
    finally{release();}
  };
  image.onerror=()=>{
    release();
    if(id===loadId.current)setError('Não foi possível abrir esta imagem. Tente um JPG ou PNG.');
  };
  image.src=url;
}
function load(e){
  const file=e.target.files?.[0];
  e.target.value='';
  if(file){
    const url=URL.createObjectURL(file);
    decode(url,()=>URL.revokeObjectURL(url));
  }
}
// Recorta somente a cópia destinada ao BMP, sem alterar o projeto editável.
function canvasParaExportar(){
  const c=ref.current;
  if(!manual)return c;
  const d=snap(),w=d.width,h=d.height;
  let l=w,r=-1,t=h,b=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(d.data[(y*w+x)*4]<128){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  }
  if(r<0){setError('Desenho vazio. Crie um objeto antes de aplicar ou salvar.');return null;}
  const out=document.createElement('canvas');
  out.width=r-l+1;out.height=b-t+1;
  out.getContext('2d').putImageData(ctx().getImageData(l,t,out.width,out.height),0,0);
  return out;
}
async function exportBitmap(){
  if(savingBmpRef.current)return;
  finishPoly();
  const canvas=canvasParaExportar();
  if(!canvas)return;
  const answer=prompt('Nome do arquivo BMP',(bitmapName || (manual?'desenho.bmp':'imagem_convertida.bmp')));
  if(answer===null)return;
  const stem=answer.trim().replace(/\.bmp$/i,'').replace(/[\\/:*?"<>|]/g,'_').trim();
  if(!stem){setError('Informe um nome para o arquivo.');return;}
  const name=stem+'.bmp';
  setError('');
  savingBmpRef.current=true;
  setSavingBmp(true);
  try{
    const bytes=encodeBitmap(canvas);
    const file=new File([bytes],name,{type:'image/bmp'});
    if(Capacitor.getPlatform()==='ios'){
      const savedCanvas=document.createElement('canvas');
      savedCanvas.width=canvas.width;
      savedCanvas.height=canvas.height;
      savedCanvas.getContext('2d').drawImage(canvas,0,0);
      const data=btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
      await Filesystem.writeFile({
        path:'Imagens/'+name,
        data,
        directory:Directory.Documents,
        recursive:true
      });
      setSavedBmp({name, canvas:savedCanvas, url:savedCanvas.toDataURL()});
      S(false);
      return;
    }
    if(Capacitor.isNativePlatform()){
      const data=btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
      const {uri}=await Filesystem.writeFile({path:name,data,directory:Directory.Cache});
      await Share.share({files:[uri]});
    }else if(navigator.canShare?.({files:[file]})){
      await navigator.share({files:[file]});
    }else{
      const url=URL.createObjectURL(file);
      const link=document.createElement('a');
      link.href=url; link.download=name;
      document.body.append(link); link.click(); link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }
    onBitmap(canvas,name,'imagens');
    S(false);
  }catch(err){
    if(err.name!=='AbortError')setError('Não foi possível exportar o BMP. '+(err.message||''));
  }finally{
    savingBmpRef.current=false;
    setSavingBmp(false);
  }
}
function filter(mode,brightness,contrast,sharp){resizeReference.current=null;const src=source.current;const d=new ImageData(new Uint8ClampedArray(src.data),src.width,src.height),w=d.width,h=d.height,a=d.data,g=new Float32Array(w*h),cl=v=>Math.max(0,Math.min(255,v));for(let i=0;i<g.length;i++)g[i]=cl((.299*a[i*4]+.587*a[i*4+1]+.114*a[i*4+2]-128)*(1+contrast/100)+128+brightness);const at=(x,y)=>g[Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x))];const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];for(let y=0;y<h;y++)for(let x=0;x<w;x++){let i=y*w+x,v=g[i];if(sharp)v=cl(v+sharp/100*(4*v-at(x-1,y)-at(x+1,y)-at(x,y-1)-at(x,y+1)));if(mode==='tracado')v=Math.hypot(at(x+1,y)-at(x-1,y),at(x,y+1)-at(x,y-1))>35?0:255;else if(mode==='negativo')v=255-v;else if(mode.startsWith('reticula')){let s=mode==='reticula grossa'?3:mode==='reticula media'?2:1;v=v>(bayer[(Math.floor(y/s)%4)*4+Math.floor(x/s)%4]+.5)*16?255:0}else if(mode==='floyd'){let q=v>=128?255:0,err=v-q;v=q;for(const [dx,dy,k] of [[1,0,7],[-1,1,3],[0,1,5],[1,1,1]])if(x+dx>=0&&x+dx<w&&y+dy<h)g[(y+dy)*w+x+dx]+=err*k/16}else if(['engrossar','afinar','suavizar','ruido'].includes(mode)){let ns=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)ns.push(at(x+dx,y+dy));v=mode==='engrossar'?Math.min(...ns):mode==='afinar'?Math.max(...ns):mode==='ruido'?ns.sort((a,b)=>a-b)[4]:ns.reduce((a,b)=>a+b,0)/9}v=v>=128?255:0;a[i*4]=a[i*4+1]=a[i*4+2]=v;a[i*4+3]=255}put(d)}
function transform(kind){save();const c=ref.current,t=document.createElement('canvas');t.width=c.width;t.height=c.height;t.getContext('2d').drawImage(c,0,0);if(kind==='girar'){let s=Math.min(1,1000/t.height,480/t.width);c.width=Math.max(1,Math.round(t.height*s));c.height=Math.max(1,Math.round(t.width*s));ctx().translate(c.width,0);ctx().rotate(Math.PI/2);ctx().drawImage(t,0,0,c.height,c.width)}else{ctx().save();ctx().translate(c.width,0);ctx().scale(-1,1);ctx().drawImage(t,0,0);ctx().restore()}ctx().setTransform(1,0,0,1,0,0);report()}
function trim(){const d=snap();let l=d.width,r=-1,t=d.height,b=-1;for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++)if(d.data[(y*d.width+x)*4]<128){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}if(r<0)return;save();put(ctx().getImageData(l,t,r-l+1,b-t+1))}
function resize(){const c=ref.current;const w=Number(prompt('Largura em pixels (1–1000)',c.width)),h=Number(prompt('Altura em pixels (1–480)',c.height));if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>1000||h>480)return;save();const t=document.createElement('canvas');t.width=w;t.height=h;const x=t.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(c,0,0,w,h);put(x.getImageData(0,0,w,h))}
function resizeStep(direction){
 finishPoly();
  const c=ref.current;
  if(!c||!c.width||!c.height)return;
  const base=resizeReference.current||snap();
  const currentScale=c.width/base.width;
  const maxScale=Math.min(1000/base.width,480/base.height);
  const minScale=Math.min(0.5,maxScale);
  const nextScale=direction>0?Math.min(maxScale,currentScale*2):Math.max(minScale,currentScale/2);
  const w=Math.max(1,Math.round(base.width*nextScale)),h=Math.max(1,Math.round(base.height*nextScale));
  if(w===c.width&&h===c.height){if(direction<0)T('Tamanho mínimo da referência. Use REDIMENSIONAR para reduzir mais.');return;}
  applyResize(base,w,h);
}
function applyResize(base,w,h,record=true){
  if(record)save();
  resizeReference.current=base;
  const t=document.createElement('canvas');t.width=base.width;t.height=base.height;
  t.getContext('2d').putImageData(base,0,0);
  const out=document.createElement('canvas');out.width=w;out.height=h;
  const x=out.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(t,0,0,w,h);
  const d=x.getImageData(0,0,w,h);put(d);commitPreview(d);
}
function resizeSlider(value){
 finishPoly();
  const c=ref.current;
  if(!c)return;
  const base=resizeReference.current||snap();
  const scale=Math.max(Math.min(0.5,1000/base.width,480/base.height),Math.min(1000/base.width,480/base.height,value/base.width));
  const w=Math.max(1,Math.round(base.width*scale)),h=Math.max(1,Math.round(base.height*scale));
  if(w===c.width&&h===c.height)return;
  applyResize(base,w,h,!sliderActive.current);
  sliderActive.current=true;
}
const sliderBase=resizeReference.current||dimensions;
const sliderMax=Math.max(1,Math.round(sliderBase.width*Math.min(1000/sliderBase.width,480/sliderBase.height)));
const sliderMin=Math.max(1,Math.round(sliderBase.width*Math.min(0.5,1000/sliderBase.width,480/sliderBase.height)));
function margins(){const n=Number(prompt('Margem branca em pixels',6)),c=ref.current;if(!Number.isInteger(n)||n<1||c.width+2*n>1000||c.height+2*n>480){T('Margem fora do limite. Redimensione primeiro.');return}save();const d=snap();c.width=d.width+2*n;c.height=d.height+2*n;ctx().fillStyle='white';ctx().fillRect(0,0,c.width,c.height);ctx().putImageData(d,n,n);report()}
function background(){save();const d=snap();for(let i=0;i<d.data.length;i+=4){const a=d.data;const v=Math.min(a[i],a[i+1],a[i+2]);if(v>205)a[i]=a[i+1]=a[i+2]=255}put(d)}
function flood(x,y){const d=snap(),w=d.width,h=d.height,a=d.data;x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=w||y>=h)return;const target=a[(y*w+x)*4]<128;if(target===!erase)return;save();const seen=new Uint8Array(w*h),q=[y*w+x];while(q.length){const i=q.pop();if(seen[i])continue;seen[i]=1;if((a[i*4]<128)!==target)continue;const v=erase?255:0;a[i*4]=a[i*4+1]=a[i*4+2]=v;a[i*4+3]=255;const xx=i%w;if(xx>0)q.push(i-1);if(xx<w-1)q.push(i+1);if(i>=w)q.push(i-w);if(i<w*(h-1))q.push(i+w)}put(d)}
function favorite(){try{const name=prompt('Nome do favorito','Imagem '+(fav.length+1));if(!name)return;const next=[...fav,{name,url:ref.current.toDataURL('image/png')}];localStorage.setItem('ctdestroyer-favoritos',JSON.stringify(next));U(next)}catch{T('Não foi possível salvar o favorito.')}}
function removeFav(i){try{const next=fav.filter((_,j)=>j!==i);localStorage.setItem('ctdestroyer-favoritos',JSON.stringify(next));U(next)}catch{T('Não foi possível remover o favorito.')}}
function openFav(f){decode(f.url)}
function originalUrl(){if(!original.current)return '';const c=document.createElement('canvas');c.width=original.current.width;c.height=original.current.height;c.getContext('2d').putImageData(original.current,0,0);return c.toDataURL()}
function point(e){const c=ref.current,r=c.getBoundingClientRect();const p=[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height];return manual&&snapGrid?p.map(v=>Math.round(v/10)*10):p}
function drawShape(end){
 const [x,y]=shapeStart.current,[a,b]=end,w=a-x,h=b-y; if(Math.hypot(w,h)<1)return;
 recordHistory();if(!vectorBase.current)vectorBase.current=snap();let points=[[x,y],[a,b]],closed=false,filled=false;
 if(['rectangle','filled'].includes(manualTool)){points=[[x,y],[a,y],[a,b],[x,b]];closed=true;filled=manualTool==='filled';}
 if(['circle','circleFilled','ellipse'].includes(manualTool)){const ellipse=manualTool==='ellipse',cx=ellipse?(x+a)/2:x,cy=ellipse?(y+b)/2:y,rx=ellipse?Math.abs(w)/2:Math.hypot(w,h),ry=ellipse?Math.abs(h)/2:rx;points=Array.from({length:64},(_,i)=>[cx+rx*Math.cos(i*Math.PI/32),cy+ry*Math.sin(i*Math.PI/32)]);closed=true;filled=manualTool==='circleFilled';}
 if(manualTool==='triangle'){points=[[(x+a)/2,y],[a,b],[x,b]];closed=true;}
 if(manualTool==='arrow'){const t=Math.atan2(h,w),l=Math.min(Math.hypot(w,h)/2,Math.max(12,size*4));points=[[x,y],[a,b],[a-l*Math.cos(t-.5),b-l*Math.sin(t-.5)],[a,b],[a-l*Math.cos(t+.5),b-l*Math.sin(t+.5)]];}
 objects.current.push({points,size,closed,filled});finishPoly();renderPoly();
}
function manualAction(action){action();commitPreview(snap());}
function clearDrawing(){if(!window.confirm('Limpar todo o desenho?'))return;save();ctx().fillStyle='white';ctx().fillRect(0,0,ref.current.width,ref.current.height);commitPreview(snap());report();}
function invertDrawing(){save();const d=snap();for(let i=0;i<d.data.length;i+=4){for(let j=0;j<3;j++)d.data[i+j]=255-d.data[i+j];}put(d);commitPreview(d);}
function flipVertical(){save();const c=ref.current,t=document.createElement('canvas');t.width=c.width;t.height=c.height;t.getContext('2d').drawImage(c,0,0);const x=ctx();x.save();x.translate(0,c.height);x.scale(1,-1);x.drawImage(t,0,0);x.restore();commitPreview(snap());report();}
const modes=[['normal','Normal'],['tracado','Traçado'],['negativo','Invertido'],['reticula fina','Retícula fina'],['reticula media','Retícula média'],['reticula grossa','Retícula grossa'],['floyd','Floyd-Steinberg'],['engrossar','Engrossar'],['afinar','Afinar'],['suavizar','Suavizar'],['ruido','Reduzir ruído']];
return <div className="ct-image-panel">
  <button className="btn btn-full" disabled={disabled} onClick={onSelectBmp}>SELECIONAR IMAGEM BMP</button>
  <label className="btn btn-full">CONVERTER IMAGEM PARA BMP<input type="file" accept="image/*" onChange={load} disabled={disabled} hidden/></label>
  <button className="btn btn-full" onClick={()=>showFavorites(!favorites)} aria-expanded={favorites}>FAVORITOS</button>
  {favorites&&<div>{!fav.length&&<p>Nenhum favorito salvo.</p>}{fav.map((f,i)=><div key={i} className="edit-actions"><button className="btn" onClick={()=>openFav(f)}>{f.name}</button><button className="btn" onClick={()=>removeFav(i)}>Excluir</button></div>)}</div>}
  <button className="btn btn-full" disabled={disabled} onClick={()=>{++loadId.current;init(null,true)}}>CRIAR DESENHO</button>
  {savedBmp ? <>
    <img className="ct-image-result" src={savedBmp.url} alt="Prévia do BMP salvo"/>
    <p role="status">BMP salvo: {savedBmp.name}<br/>Arquivos · No Meu iPhone · Lucenaart CT120 · Imagens</p>
    <button className="btn btn-full" disabled={disabled} onClick={()=>{
      onBitmap(savedBmp.canvas,savedBmp.name);
      setSavedBmp(null);
    }}>USAR NA ÁREA DE TRABALHO</button>
  </> : preview&&<img className="ct-image-result" src={preview} alt="Imagem tratada"/>}
  {!open&&error&&<p role="alert">{error}</p>}
  <div className="modal-overlay ct-image-overlay" hidden={!open}>
  <div className="ct-image-editor" style={manual?{overflowY:'auto',overflowX:'hidden'}:undefined} role="dialog" aria-modal="true" aria-label={manual?"Editor manual":"Tratamento de imagem"}>
  <h3>{manual?"EDITOR MANUAL":"TRATAMENTO DE IMAGEM"}</h3>
  {!manual&&<select aria-label="Efeito" value={mode} onChange={e=>{save(); M(e.target.value);filter(e.target.value,brightness,contrast,sharp)}}>{modes.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select>}
  {manual&&<div className="ct-image-options" style={{flex:'0 0 auto',overflow:'visible'}}>
    <label>Ferramenta
      <select value={manualTool} onChange={event=>{finishPoly();setSelectionMode(false);setManualTool(event.target.value);E(['borracha','bucketWhite'].includes(event.target.value))}}>
        <option value="lapis">Lápis</option>
        <option value="borracha">Borracha</option>
        <option value="line">Linha</option><option value="polyline">Polilinha (pontos editáveis)</option>
        <option value="bezier">Curva Bézier (4 pontos)</option><option value="rectangle">Retângulo</option>
        <option value="circle">Círculo</option>
        <option value="filled">Retângulo preenchido</option>
        <option value="circleFilled">Círculo preenchido</option><option value="ellipse">Elipse</option><option value="triangle">Triângulo</option><option value="arrow">Seta</option><option value="bucket">Preenchimento preto</option><option value="bucketWhite">Preenchimento branco</option>
      </select>
    </label>
    <label>Zoom: {zoom}×<input type="range" min={1} max={8} value={zoom} onChange={event=>Q(+event.target.value)}/></label>
    <label><input type="checkbox" checked={navigating} onChange={event=>setNavigating(event.target.checked)}/> Navegar pela imagem</label>
    <label>Espessura: {size} px<input type="range" min={1} max={20} value={size} onChange={event=>Z(+event.target.value)}/></label>
  </div>}
  {manual&&<button className="btn btn-full" aria-pressed={selectionMode} onClick={()=>{finishPoly();setSelectionMode(!selectionMode);setNavigating(false);}}>{selectionMode?'VOLTAR A DESENHAR':'SELECIONAR / EDITAR'}</button>}
  <div style={{overflow:'auto',background:'#eee',padding:4,...(manual?{maxHeight:'36dvh',flex:'0 0 auto'}:{})}}>
<div style={{position:"relative",width:`${zoom*100}%`}}><canvas ref={ref} style={{width:"100%",display:"block",height:'auto',maxHeight:manual?'none':undefined,imageRendering:'pixelated',touchAction:!navigating&&(pen||crop||fill)?'none':'auto'}} onPointerDown={e=>{
  if(manual&&navigating)return;
 if(manual&&(selectionMode||['polyline','bezier'].includes(manualTool))){polyDown(e);return;}
  if(manual&&['bucket','bucketWhite'].includes(manualTool)){flood(...point(e));commitPreview(snap());return;}
   if(manual&&manualTool!=='lapis'&&manualTool!=='borracha'){
    shapeStart.current=point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    return;
  }
  if(crop){start.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);return}if(fill){flood(...point(e));commitPreview(snap());return}if(!pen)return;save();drawing.current=true;e.currentTarget.setPointerCapture(e.pointerId);const [x,y]=point(e);ctx().fillStyle=erase?'white':'black';ctx().fillRect(x-size/2,y-size/2,size,size);ctx().beginPath();ctx().moveTo(x,y)}} onPointerMove={e=>{if(manual&&(selectionMode||['polyline','bezier'].includes(manualTool))){polyMove(e);return;}if(!drawing.current)return;const [x,y]=point(e);const c=ctx();c.strokeStyle=erase?'white':'black';c.lineWidth=size;c.lineCap='round';c.lineTo(x,y);c.stroke();c.beginPath();c.moveTo(x,y)}} onPointerUp={e=>{dragNode.current=-1;moveObject.current=null;if(manual&&(selectionMode||['polyline','bezier'].includes(manualTool)))return;if(shapeStart.current){drawShape(point(e));shapeStart.current=null;report();return}let cropped=false;if(crop&&start.current){const [x,y]=start.current,[xx,yy]=point(e),c=ref.current;const l=Math.max(0,Math.floor(Math.min(x,xx))),t=Math.max(0,Math.floor(Math.min(y,yy))),r=Math.min(c.width,Math.ceil(Math.max(x,xx))),b=Math.min(c.height,Math.ceil(Math.max(y,yy)));if(r>l&&b>t){save();put(ctx().getImageData(l,t,r-l,b-t));cropped=true}start.current=null;K(false)}if(drawing.current||cropped)commitPreview(snap());drawing.current=false;report()}} onPointerCancel={()=>{dragNode.current=-1;moveObject.current=null;shapeStart.current=null;if(drawing.current)commitPreview(snap());drawing.current=false;report()}}/>{manual&&grid&&<div style={{position:'absolute',inset:0,pointerEvents:'none',backgroundImage:'linear-gradient(to right,#1684d344 1px,transparent 1px),linear-gradient(to bottom,#1684d344 1px,transparent 1px)',backgroundSize:`${1000/dimensions.width}% ${1000/dimensions.height}%`}}/>}{manual&&(selectionMode||['polyline','bezier'].includes(manualTool))&&nodes.map(([x,y],i)=>nodes.length===64&&i%8!==0?null:<span key={i} style={{position:'absolute',left:`${100*x/dimensions.width}%`,top:`${100*y/dimensions.height}%`,width:12,height:12,borderRadius:'50%',background:'#1645dc',border:'2px solid white',transform:'translate(-50%,-50%)',pointerEvents:'none',boxSizing:'border-box'}}/>)}</div></div>
 {manual&&(selectionMode||['polyline','bezier'].includes(manualTool))&&<><p>{selectionMode?'Toque na figura e arraste para mover. Arraste os pontos azuis para editar.':'Toque para criar pontos. Arraste os pontos azuis para editar.'}</p>{selectionMode&&selected>=0&&<div className="image-tool-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:4}}><button className="btn" onClick={()=>adjustObject(1.1,0)}>+ AUMENTAR OBJETO</button><button className="btn" onClick={()=>adjustObject(1/1.1,0)}>− DIMINUIR OBJETO</button><button className="btn" onClick={()=>adjustObject(1,Math.PI/12)}>GIRAR 15°</button><button className="btn" onClick={duplicateObject}>DUPLICAR</button><button className="btn" onClick={deleteObject}>EXCLUIR OBJETO</button></div>}{!selectionMode&&<div className="image-tool-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:4}}><button className="btn" disabled={!nodes.length} onClick={polyRemove}>DESFAZER PONTO</button><button className="btn" disabled={nodes.length<3} onClick={()=>polyClose(false)}>FECHAR FORMA</button><button className="btn" disabled={nodes.length<3} onClick={()=>polyClose(true)}>PREENCHER FORMA</button><button className="btn" disabled={!nodes.length} onClick={finishPoly}>FINALIZAR LINHA</button></div>}</>}

 <p className="ct-image-stats">{status}</p>{manual&&objectCount>0&&<p>Ferramentas de pixels e alterações gerais de imagem incorporam os objetos ao BMP. Desfazer recupera os objetos editáveis.</p>}
  {<label style={{display:"block",flex:"0 0 auto"}}>Tamanho da imagem: {dimensions.width} × {dimensions.height} px<input aria-label="Tamanho da imagem" style={{display:"block",width:"100%"}} type="range" min={sliderMin} max={sliderMax} step={1} value={dimensions.width} onPointerDown={()=>{sliderActive.current=false}} onPointerUp={()=>{sliderActive.current=false}} onPointerCancel={()=>{sliderActive.current=false}} onBlur={()=>{sliderActive.current=false}} onKeyDown={()=>{sliderActive.current=false}} onChange={e=>resizeSlider(+e.target.value)}/></label>}
  {<div className="edit-actions"><button className="btn" onClick={()=>resizeStep(-1)}>− DIMINUIR</button><button className="btn" onClick={()=>resizeStep(1)}>+ AUMENTAR</button></div>}
  {manual&&<div className="image-tool-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:4,flex:'0 0 auto'}}>{[
    ['LIMPAR',clearDrawing],['INVERTER',invertDrawing],['GIRAR 90°',()=>manualAction(()=>transform('girar'))],['ESPELHAR ↔',()=>manualAction(()=>transform('espelhar'))],['ESPELHAR ↕',flipVertical],['DIMENSÕES',()=>manualAction(resize)],['TIRAR MARGENS',()=>manualAction(trim)],['+ MARGENS',()=>manualAction(margins)]
  ].map(([label,action])=><button key={label} className="btn" style={label==='LIMPAR'?{background:'#c91835'}:undefined} onClick={action}>{label}</button>)}</div>}
{manual&&<><button className="btn btn-full" type="button" aria-expanded={more} onClick={()=>setMore(v=>!v)}>{more?'MENOS FERRAMENTAS':'MAIS FERRAMENTAS'}</button>{more&&<div style={{display:"flex",flexDirection:"column",flex:"0 0 auto",minHeight:"max-content",overflow:"visible",gap:8,padding:8}}><label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Grade auxiliar (10 px)</label><label><input type="checkbox" checked={snapGrid} onChange={e=>setSnapGrid(e.target.checked)}/> Ajustar à grade</label><button className="btn" onClick={()=>{finishPoly();setSelectionMode(false);setManualTool('bezier');}}>CURVA BÉZIER</button><p>Curva: toque em quatro pontos (início, dois controles e fim).</p><div className="edit-actions"><button className="btn" disabled={selected<0} onClick={()=>centerObject(0)}>CENTRALIZAR H</button><button className="btn" disabled={selected<0} onClick={()=>centerObject(1)}>CENTRALIZAR V</button></div><div className="edit-actions"><button className="btn" disabled={selected<0} onClick={()=>layer(true)}>PARA FRENTE</button><button className="btn" disabled={selected<0} onClick={()=>layer(false)}>PARA TRÁS</button></div><button className="btn" onClick={()=>{finishPoly();setSelectionMode(true);setMulti(!multi);setMarked([]);}}> {multi?'CANCELAR SELEÇÃO MÚLTIPLA':'SELEÇÃO MÚLTIPLA'}</button>{multi&&<div>{objects.current.map((o,i)=><label key={i}><input type="checkbox" checked={marked.includes(i)} onChange={e=>setMarked(a=>e.target.checked?[...a,i]:a.filter(v=>v!==i))}/> Objeto {i+1}</label>)}</div>}<div className="edit-actions"><button className="btn" disabled={marked.length<2} onClick={groupObjects}>AGRUPAR</button><button className="btn" disabled={selected<0} onClick={ungroup}>DESAGRUPAR</button></div><button className="btn btn-full" onClick={saveProject}>SALVAR PROJETO EDITÁVEL</button><label className="btn btn-full">ABRIR PROJETO<input type="file" accept=".json" hidden onChange={openProject}/></label><label className="btn btn-full">IMPORTAR SVG (IMAGEM)<input type="file" accept=".svg,image/svg+xml" hidden onChange={importSvg}/></label></div>}</>}
  <div className="edit-actions"><button className="btn" onClick={undo}>DESFAZER</button><button className="btn" onClick={redo}>REFAZER</button></div>
  {!manual&&<div className="ct-image-options">
  {compare&&<div><p>Original</p><img src={originalUrl()} style={{maxWidth:'100%'}} alt="Original"/></div>}
  {[
    ['Brilho',brightness,B,-100,100,v=>filter(mode,v,contrast,sharp)],
    ['Contraste',contrast,C,-100,100,v=>filter(mode,brightness,v,sharp)],
    ['Nitidez',sharp,H,0,100,v=>filter(mode,brightness,contrast,v)]
  ].map(([n,v,f,min,max,render])=><label key={n}>{n}: {v}<input type="range" min={min} max={max} value={v} onPointerDown={save} onChange={e=>{const value=+e.target.value;f(value);render(value)}}/></label>)}
  {tools&&<>
    {[[ 'Zoom pixel a pixel',zoom,Q,1,3],['Pincel',size,Z,1,20]].map(([n,v,f,min,max])=><label key={n}>{n}: {v}<input type="range" min={min} max={max} value={v} onChange={e=>f(+e.target.value)}/></label>)}
    <div className="image-tool-grid">{[
      ['GIRAR',()=>transform('girar')],['ESPELHAR',()=>transform('espelhar')],['TIRAR MARGENS',trim],['ADICIONAR MARGENS',margins],['REDIMENSIONAR',resize],
      ['ORIGINAL',()=>{save();source.current=original.current;M('normal');B(0);C(0);H(0);filter('normal',0,0,0)}],
      [pen?'PARAR DESENHO':'LÁPIS',()=>{E(false);P(!pen);K(false);F(false)}],
      ['RECORTAR',()=>{K(!crop);P(false);F(false);T('Arraste sobre a região desejada')}],
      [fill?'PARAR PREENCHIMENTO':'PREENCHER',()=>{F(!fill);K(false);P(false)}],
      ['BORRACHA',()=>{E(true);P(true);K(false);F(false)}],
      ['REMOVER FUNDO CLARO',background],['COMPARAR',()=>V(!compare)],['SALVAR NOS FAVORITOS',favorite]
    ].map(([n,f])=><button key={n} className="btn" onClick={()=>{const before=snap();f();const after=snap();if(n!=='ORIGINAL'&&(before.width!==after.width||before.height!==after.height||before.data.some((pixel,i)=>pixel!==after.data[i])))commitPreview(after)}}>{n}</button>)}</div>
  </>}
  </div>}
  {error&&<p role="alert">{error}</p>}
  {!manual&&<button className="btn btn-full" disabled={disabled||savingBmp} onClick={()=>{
    onBitmap(ref.current,'imagem_convertida.bmp');
    S(false);
  }}>USAR NA ÁREA DE TRABALHO</button>}
  <footer className="ct-image-footer">
    {manual
      ? <button className="btn" disabled={disabled||savingBmp} onClick={()=>{finishPoly();const canvas=canvasParaExportar();if(!canvas)return;onBitmap(canvas,bitmapName||'desenho.bmp');S(false)}}>APLICAR</button>
      : <button className="btn" onClick={()=>showTools(!tools)} aria-expanded={tools}>FERRAMENTAS</button>}
    <button className="btn" disabled={disabled||savingBmp} onClick={exportBitmap}>{manual?"SALVAR BMP":"CONVERTER E SALVAR"}</button>
    <button className="btn" disabled={savingBmp} onClick={()=>{setError('');S(false)}}>FECHAR</button>
  </footer>
  </div></div></div>
}
