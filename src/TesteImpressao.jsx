import {useState} from 'react'

const largura = 300
const altura = 150
const padroes = [
  ['chapado','Chapado preto'],
  ['horizontais','Linhas horizontais'],
  ['verticais','Linhas verticais'],
  ['grade','Grade e detalhes finos'],
  ['qualidade','Amostra de qualidade']
]

function gerarPadrao(tipo) {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, largura, altura)
  ctx.fillStyle = 'black'

  if (tipo === 'chapado') {
    ctx.fillRect(0, 0, 100, altura)
  } else if (tipo === 'horizontais') {
    // Cada faixa de linhas é ampliada em comprimento para facilitar a inspeção.
    for (let y = 0; y < altura; y++) ctx.fillRect((y % 5) * 60, y, 58, 1)
  } else if (tipo === 'verticais') {
    for (let x = 0; x < largura; x += 10) ctx.fillRect(x, 0, 2, altura)
  } else if (tipo === 'grade') {
    for (let y = 0; y < altura; y += 8) ctx.fillRect(0, y, largura, 1)
    ctx.fillRect(0, altura - 1, largura, 1)
    for (let x = 0; x < largura; x += 8) ctx.fillRect(x, 0, 1, altura)
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

export default function TesteImpressao({onBitmap,disabled}) {
  const [open,setOpen] = useState(false)
  const [id,setId] = useState('')
  const [canvas,setCanvas] = useState(null)
  const [error,setError] = useState('')

  function escolher(tipo) {
    setId(tipo)
    setError('')
    try { setCanvas(gerarPadrao(tipo)) }
    catch (err) { setCanvas(null); setError(err.message) }
  }

  return <>
    <button className="btn" disabled={disabled} onClick={()=>{escolher('chapado');setOpen(true)}}>TESTE DE IMPRESSÃO</button>
    {open && <div className="modal-overlay">
      <div className="variable-modal effect-modal" role="dialog" aria-modal="true" aria-label="Teste de impressão">
        <h2>TESTE DE IMPRESSÃO</h2>
        <p>Os padrões de cobertura usam 150 pontos na altura, referência de 12,7 mm a 300 DPI. Verifique na impressão se há falhas ou faixas em branco.</p>
        <label>Padrão
          <select value={id} onChange={event=>escolher(event.target.value)}>
            {padroes.map(([value,name])=><option key={value} value={value}>{name}</option>)}
          </select>
        </label>
        {canvas && <img src={canvas.toDataURL()} alt="Prévia do padrão de impressão"
          style={{display:'block',maxWidth:'100%',margin:'12px auto',border:'1px solid #d6e2ee',imageRendering:'pixelated'}}/>}
        {error && <p role="alert">{error}</p>}
        <div className="edit-actions">
          <button className="btn" disabled={!canvas||disabled} onClick={()=>{onBitmap(canvas,'teste-'+id+'.bmp');setOpen(false)}}>USAR NA ÁREA DE TRABALHO</button>
          <button className="btn" onClick={()=>setOpen(false)}>VOLTAR</button>
        </div>
      </div>
    </div>}
  </>
}
