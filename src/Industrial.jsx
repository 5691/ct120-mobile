import React,{useState} from 'react'
function contarPontosBmp(base64) {
 if (!base64) return null
 try {
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
  if (bytes.length < 62 || bytes[0] !== 66 || bytes[1] !== 77) return null
  const view = new DataView(bytes.buffer)
  const offset = view.getUint32(10, true), header = view.getUint32(14, true)
  const width = view.getInt32(18, true), height = Math.abs(view.getInt32(22, true))
  const palette = 14 + header, stride = Math.ceil(width / 32) * 4
  if (header < 40 || offset < palette + 8 || width < 1 || height < 1 ||
      offset + stride * height > bytes.length || view.getUint16(26, true) !== 1 ||
      view.getUint16(28, true) !== 1 || view.getUint32(30, true) !== 0) return null
  const tone = i => bytes[i] + bytes[i + 1] + bytes[i + 2]
  const black = tone(palette + 4) < tone(palette) ? 1 : 0
  let points = 0
  for (let y = 0; y < height; y++) {
   const row = offset + y * stride
   for (let x = 0; x < width; x++) {
    if (((bytes[row + (x >> 3)] >> (7 - (x & 7))) & 1) === black) points++
   }
  }
  return points
 } catch { return null }
}

export default function Industrial({onBitmap,disabled,bmp,preview}){
 const [tool,T]=useState(''),[values,V]=useState([]),[result,R]=useState(''),[bmpPoints,setBmpPoints]=useState(null);
 const tools={diagnostico:['DIAGNÓSTICO DE IMPRESSÃO',[]],regua:['RÉGUA DE CALIBRAÇÃO',[['Comprimento (mm)',20],['Resolução (DPI)',300]]],encoder:['CALCULADORA INDUSTRIAL',[['Velocidade (m/min)',60],['Diâmetro da roda (mm)',67.5],['Pulsos por volta',2500],['Resolução (DPI)',300]]],rendimento:['SIMULADOR DE CONSUMO',[['Volume útil (ml)',42],['Preço (R$)',250],['Pontos pretos por impressão',''],['Volume por ponto (pL)',10]]]};
 function open(k){
  const points = k === 'rendimento' ? contarPontosBmp(bmp) : null
  setBmpPoints(points)
  T(k)
  V(tools[k][1].map((field,i)=>String(k==='rendimento' && i===2 && points!==null ? points : field[1])))
  R('')
 }
 function calc(){const a=values.map(x=>Number(x.replace(',','.')));if(values.some(x=>!x.trim())||a.some((x,i)=>!Number.isFinite(x)||x<0||(x===0 && !(tool==='rendimento' && i===2)))){R('Informe valores positivos válidos.');return}const [p,q,r,s]=a;const f=x=>x.toLocaleString('pt-BR',{maximumFractionDigits:4});if(tool==='encoder'){const rpm=p*1000/(Math.PI*q);R(`Rotação: ${f(rpm)} rpm\nFrequência: ${f(rpm*r/60)} Hz\nPulsos/mm: ${f(r/(Math.PI*q))}\nPulsos por ponto: ${f(r/(Math.PI*q)*25.4/s)}`);return}if(tool==='rendimento'){
 if(r===0){R('A imagem está sem pontos pretos. Consumo de impressão estimado: 0 mL.');return}
 const consumption=r*s/1e9, impressions=p/consumption, cost=q/impressions
 if(!Number.isSafeInteger(r)||![consumption,impressions,cost,cost*1000].every(x=>Number.isFinite(x)&&x>0)){R('Informe valores válidos. O número de pontos deve ser inteiro.');return}
 const precise=value=>value.toLocaleString('pt-BR',{maximumSignificantDigits:6})
 R('Consumo por impressão: '+precise(consumption)+' mL\nImpressões estimadas: '+f(Math.floor(impressions))+'\nCusto por mil impressões: R$ '+f(cost*1000))
 return
 }const c=document.createElement('canvas');c.width=tool==='regua'?Math.round(p*q/25.4):480;c.height=120;if(c.width<2||c.width>12000){R('Comprimento fora do limite de 2 a 12000 pixels.');return}const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';if(tool==='regua'){x.fillRect(0,0,c.width,3);for(let i=0;i<=p;i++){const pos=Math.min(c.width-1,Math.round(i*q/25.4));x.fillRect(pos,0,2,i%10===0?65:i%5===0?45:25)}}else{for(let i=0;i<120;i+=4)x.fillRect(0,i,480,1);for(let i=0;i<480;i+=16)x.fillRect(i,0,2,120)}onBitmap(c,tool+'.bmp');T('')}
 return <><div className="industrial-grid">{Object.entries(tools).map(([k,[name]])=><button key={k} className="btn" disabled={disabled} onClick={()=>open(k)}>{name}</button>)}</div>{tool&&<div className="modal-overlay"><div className="variable-modal effect-modal" role="dialog" aria-modal="true"><h2>{tools[tool][0]}</h2>{tool==='rendimento'&&<>
 <p><strong>Obs.</strong> Os resultados são estimativas. O consumo e o rendimento reais variam conforme o cartucho, as configurações do datador, a cobertura da impressão e as perdas de tinta, como as de limpeza e purga.</p>
 {bmpPoints!==null && preview && <img src={preview} alt="BMP da Área de Trabalho" style={{display:'block',maxWidth:'100%',maxHeight:120,margin:'8px auto',imageRendering:'pixelated'}}/>}
 <p>{bmpPoints===null ? 'Selecione um BMP monocromático para preencher os pontos automaticamente ou informe o valor manualmente.' : 'Pontos preenchidos com o BMP da Área de Trabalho. Você pode editar o valor.'}</p>
 </>}{tools[tool][1].map(([label],i)=><label key={label}>{label}<input type="text" inputMode="decimal" value={values[i]} onChange={e=>{V(old=>old.map((v,j)=>j===i?e.target.value:v));R('')}}/></label>)}{tool==='diagnostico'&&<p>Gera padrão de linhas para inspeção visual da impressão.</p>}{tool==='regua'&&<p>Comprimento físico depende do DPI e da calibração do equipamento.</p>}<div className="edit-actions"><button className="btn" onClick={calc}>{['regua','diagnostico'].includes(tool)?'GERAR BMP':'CALCULAR'}</button><button className="btn" onClick={()=>T('')}>VOLTAR</button></div><div className="result-box" style={{whiteSpace:'pre-wrap'}}>{result}</div></div></div>}</>
}
