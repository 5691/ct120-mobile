import {useState, useRef} from 'react'

const padroes = [
  ['chapado','Chapado preto'],
  ['horizontais','Linhas horizontais'],
  ['verticais','Linhas verticais'],
  ['grade','Grade e detalhes finos'],
  ['qualidade','Amostra de qualidade'],
  ['bicos','Teste escalonado de pontos'], ['diagonal','Linhas diagonais'], ['cobertura','Escala de cobertura'], ['xadrez','Tabuleiro xadrez'], ['regua','Régua milimetrada'], ['texto','Texto de vários tamanhos'], ['personalizado','Padrão personalizado'], ['importado','BMP importado']
]

function gerarPadrao(tipo, largura, altura, passo) {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, largura, altura)
  ctx.fillStyle = 'black'

  if (tipo === 'chapado') {
    ctx.fillRect(0, 0, largura, altura)
  } else if (tipo === 'horizontais') {
    // Cada faixa de linhas é ampliada em comprimento para facilitar a inspeção.
    for (let y = 0; y < altura; y++) ctx.fillRect((y % 5) * Math.floor(largura/5), y, Math.max(1,Math.floor(largura/5)-2), 1)
  } else if (tipo === 'verticais') {
    for (let x = 0; x < largura; x += 10) ctx.fillRect(x, 0, 2, altura)
  } else if (tipo === 'grade') {
    for (let y = 0; y < altura; y += 8) ctx.fillRect(0, y, largura, 1)
    ctx.fillRect(0, altura - 1, largura, 1)
    for (let x = 0; x < largura; x += 8) ctx.fillRect(x, 0, 1, altura)
  } else if (tipo === 'bicos') {
    for(let y=0;y<altura;y++) {const a=Math.floor((y%10)*largura/10), b=Math.floor((y%10+1)*largura/10);ctx.fillRect(a,y,Math.max(1,b-a-1),1)}
  } else if (tipo === 'diagonal') {
    for(let y=0;y<altura;y++)for(let x=y%passo;x<largura;x+=passo)ctx.fillRect(x,y,1,1)
  } else if (tipo === 'cobertura') {
    const niveis=[10,25,50,75,100];const matriz=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
    for(let y=0;y<altura;y++)for(let x=0;x<largura;x++)if(matriz[(y%4)*4+x%4]<niveis[Math.min(4,Math.floor(x*5/largura))]*16/100)ctx.fillRect(x,y,1,1)
  } else if (tipo === 'xadrez') {
    for(let y=0;y<altura;y+=passo)for(let x=0;x<largura;x+=passo)if((x/passo+y/passo)%2===0)ctx.fillRect(x,y,passo,passo)
  } else if (tipo === 'regua') {
    ctx.fillRect(0,0,largura,1);for(let mm=0;Math.round(mm*300/25.4)<largura;mm++){const x=Math.round(mm*300/25.4);ctx.fillRect(x,0,1,Math.min(altura,mm%10===0?30:mm%5===0?20:10));if(mm%10===0){ctx.font='10px Arial';ctx.fillText(String(mm),x+2,Math.min(altura-1,42))}}
  } else if (tipo === 'personalizado') {
    for(let y=0;y<altura;y+=passo)ctx.fillRect(0,y,largura,1);for(let x=0;x<largura;x+=passo)ctx.fillRect(x,0,1,altura)
  } else if (tipo === 'texto') {
    let y=0;for(const n of [32,24,18,14,10,8]){y+=n+3;ctx.font=`${n}px Arial`;ctx.fillText(`${n}px CT120 TESTE`,2,y,largura-4)}
  } else if (tipo === 'qualidade') {
    ctx.fillRect(0, 0, 48, altura)
    ctx.textBaseline = 'middle'
    const inicio = 58
    const fim = largura - 6
    const linhas = [
      ['bold 32px Arial', 'CT120 DESTROYER', 21],
      ['bold 24px Arial', 'VAL: 31/12/2027', 53],
      ['18px Arial', 'VAL: 31/12/2027', 78],
      ['14px Arial', 'VAL: 31/12/2027', 98],
      ['10px Arial', 'VAL: 31/12/2027', 114],
      ['8px Arial', 'VAL: 31/12/2027', 126]
    ]
    for (const [fonte, texto, y] of linhas) {
      ctx.font = fonte
      ctx.fillText(texto, inicio, y, fim - inicio)
    }
    for (let x = inicio; x < fim; x += 4) {
      const comprimento = (x - inicio) % 20 === 0 ? 8 : 4
      ctx.fillRect(x, altura - 1 - comprimento, 1, comprimento)
    }
    ctx.fillRect(inicio, altura - 1, fim - inicio, 1)
  }
  return canvas
}

function bmp(c){
  const w=c.width,h=c.height,stride=Math.ceil(w/32)*4,b=new Uint8Array(62+stride*h),v=new DataView(b.buffer),d=c.getContext('2d').getImageData(0,0,w,h).data;
  b[0]=66;b[1]=77;v.setUint32(2,b.length,true);v.setUint32(10,62,true);v.setUint32(14,40,true);v.setInt32(18,w,true);v.setInt32(22,h,true);v.setUint16(26,1,true);v.setUint16(28,1,true);v.setUint32(34,stride*h,true);v.setInt32(38,11811,true);v.setInt32(42,11811,true);v.setUint32(46,2,true);b.set([255,255,255,0],58);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4]>127)b[62+(h-1-y)*stride+(x>>3)]|=128>>(x%8);return b;
}
export default function TesteImpressao({onBitmap,disabled}) {
  const [open,setOpen]=useState(false),[id,setId]=useState('chapado'),[canvas,setCanvas]=useState(null),[error,setError]=useState('');
  const [w,setW]=useState('25.4'),[h,setH]=useState('12.7'),[passo,setPasso]=useState('8');
  const input=useRef(null);
  function escolher(tipo,ww=w,hh=h,pp=passo){setId(tipo);setError('');try{const x=Math.round(Number(ww)*300/25.4),y=Math.round(Number(hh)*300/25.4),p=Number(pp);if(!Number.isInteger(x)||x<8||x>6000||!Number.isInteger(y)||y<1||y>150||!Number.isInteger(p)||p<2||p>100)throw Error('Largura: 0,7 a 508 mm; altura: até 12,7 mm; passo: 2 a 100 pontos.');setCanvas(gerarPadrao(tipo,x,y,p))}catch(e){setCanvas(null);setError(e.message)}}
  async function importar(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;setError('');try{const bytes=await f.arrayBuffer(),v=new DataView(bytes);if(bytes.byteLength<54||v.getUint16(0,true)!==0x4d42)throw Error('Selecione um BMP válido.');const x=v.getInt32(18,true),y=Math.abs(v.getInt32(22,true));if(x<1||x>6000||y<1||y>150)throw Error('BMP deve ter até 6000 × 150 pontos.');const url=URL.createObjectURL(f);try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('BMP não suportado pelo navegador.'));img.src=url});const c=document.createElement('canvas');c.width=x;c.height=y;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,x,y);ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,x,y);for(let i=0;i<d.data.length;i+=4){const n=(d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114)>127?255:0;d.data[i]=d.data[i+1]=d.data[i+2]=n;d.data[i+3]=255}ctx.putImageData(d,0,0);setCanvas(c);setId('importado');setW(String(+(x*25.4/300).toFixed(3)));setH(String(+(y*25.4/300).toFixed(3)))}finally{URL.revokeObjectURL(url)}}catch(err){setError(err.message)}}
  async function exportar(){try{const file=new File([bmp(canvas)],`teste-${id}.bmp`,{type:'image/bmp'});try{if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file]});return}}catch(e){if(e.name==='AbortError')return}const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError(e.message)}}
  const grid={display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:6};
  return <><button className="btn" disabled={disabled} onClick={()=>{setW('25.4');setH('12.7');setPasso('8');escolher('chapado','25.4','12.7','8');setOpen(true)}}>TESTE DE IMPRESSÃO</button>
  {open&&<div className="modal-overlay"><div className="variable-modal effect-modal" role="dialog" aria-modal="true" aria-label="Teste de impressão" style={{display:'block',overflowY:'auto',maxHeight:'85dvh'}}>
  <h2>TESTE DE IMPRESSÃO</h2><p style={{fontSize:13}}>Referência: 300 DPI. Altura máxima de 150 pontos (12,7 mm). Confira falhas e dimensões na impressão.</p>
  <label>Padrão<select value={id} onChange={e=>escolher(e.target.value)}>{padroes.filter(([v])=>v!=='importado'||id==='importado').map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
  <div style={grid}><label>Largura (mm)<input type="number" min="0.7" max="508" step="0.1" value={w} disabled={id==='importado'} onChange={e=>{setW(e.target.value);escolher(id,e.target.value,h,passo)}}/></label><label>Altura (mm)<input type="number" min="0.085" max="12.7" step="0.1" value={h} disabled={id==='importado'} onChange={e=>{setH(e.target.value);escolher(id,w,e.target.value,passo)}}/></label></div>
  {['diagonal','xadrez','personalizado'].includes(id)&&<label>Espaçamento (pontos)<input type="number" min="2" max="100" value={passo} onChange={e=>{setPasso(e.target.value);escolher(id,w,h,e.target.value)}}/></label>}
  {id==='cobertura'&&<p style={{fontSize:12}}>Da esquerda para a direita: 10% nominal, 25%, 50%, 75%, 100%.</p>}
  {canvas&&<><div style={{overflowX:'auto',border:'1px solid #d6e2ee',background:'white',padding:4}}><img src={canvas.toDataURL()} alt="Prévia do padrão" style={{display:'block',width:'100%',height:'auto',imageRendering:'pixelated'}}/></div><p style={{fontSize:12}}>{canvas.width} × {canvas.height} pontos</p></>}
  {error&&<p role="alert" style={{color:'#b70b29'}}>{error}</p>}
  <input ref={input} type="file" accept=".bmp,image/bmp,image/x-ms-bmp" style={{display:'none'}} onChange={importar}/>
  <div style={grid}><button className="btn" onClick={()=>input.current?.click()}>IMPORTAR BMP</button><button className="btn" disabled={!canvas} onClick={exportar}>EXPORTAR BMP</button><button className="btn" disabled={!canvas||disabled} onClick={()=>{onBitmap(canvas,'teste-'+id+'.bmp');setOpen(false)}}>USAR NA ÁREA DE TRABALHO</button><button className="btn" onClick={()=>setOpen(false)}>VOLTAR</button></div>
  </div></div>}</>
}
