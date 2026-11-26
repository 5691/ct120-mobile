import {useRef,useState} from 'react'
import bwipjs from 'bwip-js'
const formats=[['QR Code','qrcode'],['Data Matrix','datamatrix'],['Code 128','code128'],['GS1-128','gs1-128'],['EAN-13','ean13'],['EAN-8','ean8'],['EAN-14','itf14'],['UPC-A','upca'],['Code 39','code39'],['Code 93','code93'],['Interleaved 2 of 5','interleaved2of5'],['PDF417','pdf417']];
const digitosComVerificador = {ean13:13,ean8:8,itf14:14,upca:12}

function legendaNumerica(value,total) {
 if (!/^\d+$/.test(value) || value.length < total - 1 || value.length > total) return ''
 if (value.length === total) return value
 const soma = [...value].reverse().reduce((acc,d,i)=>acc+Number(d)*(i%2===0?3:1),0)
 return value + (10 - soma % 10) % 10
}

function renderizarCodigo(canvas,format,value,linear) {
 const codigo = document.createElement('canvas')
 const legenda = legendaNumerica(value.trim(),digitosComVerificador[format] ?? 0)
 const alturaLegenda = legenda ? 24 : 0
 for (const scale of linear ? [3,2,1] : [1]) {
  bwipjs.toCanvas(codigo,{
   bcid:format, text:value, scale, padding:10, backgroundcolor:'FFFFFF',
   includetext:linear&&!legenda, ...(linear?{height:12}:{}),
   ...(legenda?{paddingheight:1}:{}), ...(format==='itf14'?{showborder:false}:{})
  })
  if (codigo.width>480 || codigo.height+alturaLegenda>240) continue

  canvas.width=codigo.width
  canvas.height=codigo.height+alturaLegenda
  const ctx=canvas.getContext('2d')
  ctx.fillStyle='white'
  ctx.fillRect(0,0,canvas.width,canvas.height)
  ctx.drawImage(codigo,0,0)
  if (legenda) {
   const pixels=ctx.getImageData(0,0,codigo.width,codigo.height).data
   let esquerda=codigo.width, direita=-1
   for(let y=0;y<codigo.height;y++) {
    for(let x=0;x<codigo.width;x++) {
     if(pixels[(y*codigo.width+x)*4]<128) {
      esquerda=Math.min(esquerda,x)
      direita=Math.max(direita,x)
     }
    }
   }
   if(direita<esquerda) throw Error('O código foi gerado sem barras.')
   const larguraBarras=direita+1-esquerda
   ctx.fillStyle='black'
   ctx.textBaseline='top'
   ctx.textAlign='left'
   ctx.font=Math.min(22,larguraBarras/legenda.length*1.25)+'px Arial'
   const primeiro=ctx.measureText(legenda[0])
   const ultimo=ctx.measureText(legenda.at(-1))
   const inicio=esquerda+primeiro.actualBoundingBoxLeft
   const fim=direita+1-ultimo.actualBoundingBoxRight
   const passo=(fim-inicio)/(legenda.length-1)
   for(const [i,digito] of [...legenda].entries()) {
    ctx.fillText(digito,inicio+i*passo,codigo.height)
   }
  }
  return
 }
 throw Error('Código excede 480 × 240 px.')
}

export default function GeradorCodigos({onCopy,onUse,onBack,disabled}) {
 const ref=useRef(null)
 const [value,setValue]=useState(''),[format,setFormat]=useState('qrcode')
 const [ready,setReady]=useState(false),[status,setStatus]=useState('')
 function generate(){
  setReady(false)
  try {
   if(!value.trim()) throw Error('Digite o conteúdo do código.')
   const linear=!['qrcode','datamatrix','pdf417'].includes(format)
   renderizarCodigo(ref.current,format,value,linear)
   setReady(true);setStatus('Confira a prévia. Você pode usar o código na área de trabalho ou copiá-lo.')
  } catch(error){setStatus(error.message)}
 }
 function usarNaArea(){
  try {
   onUse(ref.current, format + '.bmp')
  } catch (erro) {
   setStatus(erro.message)
  }
 }
 function copy(){
  if(ready){onCopy(ref.current,format+'.bmp');setStatus('Código copiado. Toque em Voltar e depois em Colar.')}
  else navigator.clipboard.writeText(value).catch(()=>setStatus('Selecione o texto para copiar.'))
 }
 function update(text){setValue(text);setReady(false);setStatus('')}
 return <div>
  <strong>GERADOR DE CÓDIGOS</strong>
  <textarea aria-label="Conteúdo do código" placeholder="Digite o conteúdo do código" value={value} onChange={e=>update(e.target.value)} disabled={disabled}/>
  <div className="edit-actions">
   <button className="btn" disabled={disabled} onClick={copy}>Copiar</button>
   <button className="btn" disabled={disabled} onClick={async()=>{try{update(await navigator.clipboard.readText())}catch{setStatus('Use a opção Colar do teclado.')}}}>Colar</button>
   <button className="btn" onClick={onBack}>Voltar</button>
  </div>
  <select aria-label="Formato" value={format} onChange={e=>{setFormat(e.target.value);setReady(false);setStatus('')}}>{formats.map(([label,id])=><option key={id} value={id}>{label}</option>)}</select>
  <button className="btn btn-full" disabled={disabled} onClick={generate}>GERAR CÓDIGO</button>
  <button type="button" aria-label="Copiar código gerado" hidden={!ready} disabled={disabled} onClick={copy} style={{background:'white',border:0,margin:'8px auto',width:'100%'}}>
   <canvas ref={ref} style={{display:'block',maxWidth:'100%',width:['qrcode','datamatrix','pdf417'].includes(format)?'auto':'min(100%, 480px)',minWidth:80,height:'auto',margin:'auto',imageRendering:'pixelated'}}/>
  </button>
  {ready && <button type="button" className="btn btn-full" disabled={disabled} onClick={usarNaArea}>USAR NA ÁREA DE TRABALHO</button>}
  <button className="btn btn-full" disabled={disabled} onClick={()=>update('')}>LIMPAR CÓDIGO</button>
  <p role="status">{status||'Digite o conteúdo e escolha o formato.'}</p>
 </div>
}
