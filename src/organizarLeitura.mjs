const grupos = [
  ['COD','OBRA','CLIENTE'],
  ['PEÇA','Nº','DIM'],
  ['PESO','VOL','LOTE','VAL']
]
const nomes = new Map(Object.entries({
  codigo:'COD',cod:'COD',obra:'OBRA',cliente:'CLIENTE',peca:'PEÇA',
  'nº':'Nº','n°':'Nº','n.':'Nº',no:'Nº',numero:'Nº',
  'descricao/dimensao(mt)':'DIM',dimensao:'DIM','peso(kg)':'PESO',peso:'PESO',
  'volume(m3)':'VOL',volume:'VOL',lote:'LOTE',validade:'VAL'
}))
export function organizarLeitura(original, quantidade) {
  const campos = new Map()
  for (const linha of original.split(/\r\n|\r|\n/)) {
    const pos = linha.indexOf(':')
    if (pos < 0) continue
    const nome = nomes.get(linha.slice(0,pos).normalize('NFD').replace(/\p{M}/gu,'').replace(/\s/g,'').toLowerCase())
    const valor = linha.slice(pos+1).trim()
    if (nome && valor) campos.set(nome, nome + ' ' + valor)
  }
  if (!campos.size) return original
  const linhas = quantidade === 1 ? [grupos.flat()] : quantidade === 2 ? [grupos[0], grupos.slice(1).flat()] : grupos
  return linhas.map(g => g.map(k => campos.get(k)).filter(Boolean).join(' | ')).filter(Boolean).join('\n')
}
