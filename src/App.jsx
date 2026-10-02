import { useEffect, useRef, useState } from 'react'
import { BleClient } from '@capacitor-community/bluetooth-le'
import './App.css'

const SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb'
const NOTIFY_UUID  = '0000fff1-0000-1000-8000-00805f9b34fb'
const WRITE_UUID   = '0000fff2-0000-1000-8000-00805f9b34fb'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function App() {
  const [status, setStatus] = useState('Desconectado')
  const [texto, setTexto] = useState('TESTE LUCENAART')
  const [modo, setModo] = useState('text')
  const [retorno, setRetorno] = useState('')
  const [editorAberto, setEditorAberto] = useState(false)
  const [aba, setAba] = useState('datetime')
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [imagemNome, setImagemNome] = useState('')
  const [imagemBase64, setImagemBase64] = useState('')
  const [preview, setPreview] = useState('')
  const [nomeTrabalho, setNomeTrabalho] = useState('')
  const [trabalhos, setTrabalhos] = useState([])
  const [trabalhoSelecionado, setTrabalhoSelecionado] = useState('')
  const importarRef = useRef(null)


  // =========================================================
  // TRABALHOS .CT120.JSON — mesmo formato do Android/Windows
  // No iPhone a biblioteca interna fica no armazenamento do app.
  // Importar/Compartilhar usam o seletor/compartilhamento do iOS.
  // =========================================================
  useEffect(() => {
    try {
      const salvos = JSON.parse(localStorage.getItem('ct120_trabalhos') || '[]')
      if (Array.isArray(salvos)) setTrabalhos(salvos.sort((a, b) => a.nome.localeCompare(b.nome)))
    } catch {
      setTrabalhos([])
    }
  }, [])

  function persistirTrabalhos(lista) {
    const ordenada = [...lista].sort((a, b) => a.nome.localeCompare(b.nome))
    setTrabalhos(ordenada)
    localStorage.setItem('ct120_trabalhos', JSON.stringify(ordenada))
  }

  function montarTrabalho(nomeForcado = '') {
    const nome = (nomeForcado || nomeTrabalho).trim() || 'Trabalho'
    const trabalho = {
      formato: 'Lucenaart CT120 Manager',
      versao: '1.3',
      nome,
      tipo: modo,
      texto: modo === 'image' ? '' : texto,
      salvoEm: new Date().toISOString()
    }
    if (modo === 'image') {
      trabalho.imagemBase64 = imagemBase64
      trabalho.imagemNome = imagemNome || `${nome}.bmp`
    }
    return trabalho
  }

  function validarTrabalhoParaSalvar() {
    const nome = nomeTrabalho.trim()
    if (!nome) throw new Error('Digite o nome do trabalho.')
    if (modo === 'image' && !imagemBase64) throw new Error('Selecione uma imagem primeiro.')
    if (modo !== 'image' && !texto.trim()) throw new Error('Digite o conteúdo do trabalho.')
    return nome
  }

  function novoTrabalho() {
    setNomeTrabalho('')
    setTrabalhoSelecionado('')
    setModo('text')
    limparConteudo()
    setRetorno('Novo trabalho.')
  }

  function salvarTrabalho() {
    try {
      const nome = validarTrabalhoParaSalvar()
      const trabalho = montarTrabalho(nome)
      const lista = trabalhos.filter(t => t.nome.toLowerCase() !== nome.toLowerCase())
      persistirTrabalhos([...lista, trabalho])
      setTrabalhoSelecionado(nome)
      setRetorno(`✓ Trabalho salvo: ${nome}.ct120.json`)
    } catch (error) {
      setRetorno(`ERRO: ${error.message}`)
    }
  }

  function aplicarTrabalho(trabalho) {
    if (!trabalho || trabalho.formato !== 'Lucenaart CT120 Manager') {
      throw new Error('Arquivo não é um trabalho Lucenaart CT120 Manager.')
    }
    const tipo = ['text', 'variable', 'image'].includes(trabalho.tipo) ? trabalho.tipo : 'text'
    setNomeTrabalho(trabalho.nome || 'Trabalho')
    setTrabalhoSelecionado(trabalho.nome || '')
    setModo(tipo)
    setTexto(tipo === 'image' ? '' : (trabalho.texto || ''))
    if (tipo === 'image') {
      const b64 = trabalho.imagemBase64 || ''
      setImagemBase64(b64)
      setImagemNome(trabalho.imagemNome || `${trabalho.nome || 'Trabalho'}.bmp`)
      setPreview(b64 ? `data:image/bmp;base64,${b64}` : '')
    } else {
      setImagemBase64('')
      setImagemNome('')
      setPreview('')
    }
    setProgresso(0)
    setRetorno(`✓ Trabalho aberto: ${trabalho.nome || 'Trabalho'}`)
  }

  function abrirTrabalho() {
    try {
      const trabalho = trabalhos.find(t => t.nome === trabalhoSelecionado)
      if (!trabalho) throw new Error('Selecione um trabalho.')
      aplicarTrabalho(trabalho)
    } catch (error) {
      setRetorno(`ERRO: ${error.message}`)
    }
  }

  function excluirTrabalho() {
    if (!trabalhoSelecionado) {
      setRetorno('ERRO: Selecione um trabalho.')
      return
    }
    if (!window.confirm(`Excluir o trabalho "${trabalhoSelecionado}"?`)) return
    persistirTrabalhos(trabalhos.filter(t => t.nome !== trabalhoSelecionado))
    setRetorno(`Trabalho excluído: ${trabalhoSelecionado}`)
    setTrabalhoSelecionado('')
  }

  function importarTrabalho(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const trabalho = JSON.parse(String(reader.result))
        if (trabalho.formato !== 'Lucenaart CT120 Manager') {
          throw new Error('Arquivo não é um trabalho Lucenaart CT120 Manager.')
        }
        const nome = trabalho.nome || file.name.replace(/\.ct120\.json$/i, '').replace(/\.json$/i, '')
        trabalho.nome = nome
        const lista = trabalhos.filter(t => t.nome.toLowerCase() !== nome.toLowerCase())
        persistirTrabalhos([...lista, trabalho])
        aplicarTrabalho(trabalho)
        setRetorno(`✓ Trabalho importado: ${nome}.ct120.json`)
      } catch (error) {
        setRetorno(`ERRO ao importar: ${error.message}`)
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  function baixarTrabalho(trabalho) {
    const nomeSeguro = (trabalho.nome || 'Trabalho').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Trabalho'
    const blob = new Blob([JSON.stringify(trabalho, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nomeSeguro}.ct120.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function compartilharTrabalho() {
    try {
      const trabalho = trabalhos.find(t => t.nome === trabalhoSelecionado)
      if (!trabalho) throw new Error('Selecione um trabalho.')
      const nomeSeguro = (trabalho.nome || 'Trabalho').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Trabalho'
      const file = new File(
        [JSON.stringify(trabalho, null, 2)],
        `${nomeSeguro}.ct120.json`,
        { type: 'application/json' }
      )
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: 'Trabalho CT120', files: [file] })
        setRetorno(`Compartilhando trabalho: ${trabalho.nome}`)
      } else {
        baixarTrabalho(trabalho)
        setRetorno(`Arquivo preparado: ${trabalho.nome}.ct120.json`)
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setRetorno(`ERRO ao compartilhar: ${error.message}`)
    }
  }

  async function desconectarCT120() {
    try {
      const device = deviceRef.current
      if (device?.deviceId) await BleClient.disconnect(device.deviceId)
    } catch {
      // Se já estiver desconectado, apenas limpamos o estado local.
    }
    deviceRef.current = null
    writeRef.current = null
    notifyRef.current = null
    limparAck()
    setStatus('Desconectado')
    setRetorno('Bluetooth desconectado.')
  }

  // Variáveis do editor
  const [dateBlock, setDateBlock] = useState('0')
  const [dateTimeFormat, setDateTimeFormat] = useState('dd-MM-yyyy  HH:mm')
  const [dateFormat, setDateFormat] = useState('dd-MM-yyyy')
  const [calendar, setCalendar] = useState('Gregorian')
  const [timeFormat, setTimeFormat] = useState('HH:mm')
  const [counterNum, setCounterNum] = useState('counter')
  const [counterDigits, setCounterDigits] = useState('none')
  const [thousands, setThousands] = useState(false)
  const [shiftBlock, setShiftBlock] = useState('1')
  const [dataCounter, setDataCounter] = useState('1')
  const [dataColumn, setDataColumn] = useState('1')
  const [udiId, setUdiId] = useState('1')

  const deviceRef = useRef(null)
  const writeRef = useRef(null)
  const notifyRef = useRef(null)
  const ackResolverRef = useRef(null)
  const ackTimerRef = useRef(null)
  const expectedAckRef = useRef(-1)
  const abortRef = useRef(false)

  function arrayBufferToBase64(buffer) {
    let binary = ''
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }

  function calculateChecksum(data) {
    let checksum = 0
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    for (let i = 0; i < bytes.length; i++) checksum += bytes[i]
    return checksum & 0xFFFF
  }

  function createJsonPacket(dataType, data, packetIndex, totalPackets, fileName = '') {
    let encodedData
    let checksumData

    if (dataType === 'image') {
      // Igual ao Windows: a imagem já chega como string Base64 e é codificada
      // novamente em Base64 para o pacote BLE.
      const base64Bytes = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) base64Bytes[i] = data.charCodeAt(i)
      encodedData = arrayBufferToBase64(base64Bytes)
      checksumData = base64Bytes
    } else {
      encodedData = arrayBufferToBase64(data)
      checksumData = data
    }

    return {
      msgType: 'data',
      type: dataType,
      index: packetIndex + 1,
      total: totalPackets,
      data: encodedData,
      checksum: calculateChecksum(checksumData),
      filename: fileName,
      timestamp: Date.now()
    }
  }

  function limparAck() {
    if (ackTimerRef.current) clearTimeout(ackTimerRef.current)
    ackTimerRef.current = null
    ackResolverRef.current = null
    expectedAckRef.current = -1
  }

  function esperarAck(index, timeout = 5000) {
    limparAck()
    expectedAckRef.current = index

    return new Promise((resolve, reject) => {
      ackResolverRef.current = { resolve, reject }
      ackTimerRef.current = setTimeout(() => {
        const atual = expectedAckRef.current
        limparAck()
        reject(new Error(`Tempo de espera do ACK ${atual} esgotado`))
      }, timeout)
    })
  }

  function onNotification(valueOrEvent) {
    try {
      const value = valueOrEvent instanceof DataView
        ? valueOrEvent
        : valueOrEvent?.target?.value

      if (!value) return

      const recebido = new TextDecoder().decode(value)
      const json = JSON.parse(recebido)

      if (json.msgType === 'ack') {
        const esperado = expectedAckRef.current
        if (json.index === esperado && ackResolverRef.current) {
          const resolver = ackResolverRef.current
          limparAck()
          if (json.success) {
            setRetorno(`✓ CT120 CONFIRMOU O RECEBIMENTO — ACK ${json.index}`)
            resolver.resolve(json)
          } else {
            resolver.reject(new Error(json.errorReason || `ACK ${json.index} recusado`))
          }
        }
      }
    } catch {
      // O CT120 também pode notificar dados que não sejam JSON.
    }
  }

  async function conectarCT120() {
    try {
      setStatus('Inicializando Bluetooth...')
      await BleClient.initialize()

      setStatus('Procurando CT120...')

      const device = await BleClient.requestDevice({
        services: [SERVICE_UUID]
      })

      deviceRef.current = device

      setStatus(`Encontrado: ${device.name || 'CT120'} — conectando...`)

      await BleClient.connect(device.deviceId, () => {
        writeRef.current = null
        notifyRef.current = null
        limparAck()
        setStatus('Desconectado')
        setRetorno('Bluetooth desconectado.')
      })

      await BleClient.startNotifications(
        device.deviceId,
        SERVICE_UUID,
        NOTIFY_UUID,
        onNotification
      )

      writeRef.current = {
        async writeValue(bytes) {
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
          await BleClient.write(device.deviceId, SERVICE_UUID, WRITE_UUID, view)
        }
      }

      notifyRef.current = true

      setStatus(`CT120 CONECTADO: ${device.name || 'CT120'}`)
      setRetorno('Bluetooth BLE nativo pronto.')
    } catch (error) {
      writeRef.current = null
      notifyRef.current = null
      limparAck()
      setStatus(`Erro: ${error?.message || String(error)}`)
    }
  }

  function prepararDados() {
    if (modo === 'image') {
      if (!imagemBase64) throw new Error('Selecione uma imagem primeiro')
      return imagemBase64
    }

    if (!texto) throw new Error('Digite os dados a enviar')
    return new TextEncoder().encode(texto)
  }

  async function enviarPacotes(dataType, data, fileName = '') {
    if (!writeRef.current) throw new Error('Conecte o CT120 primeiro')

    abortRef.current = false
    setEnviando(true)
    setProgresso(0)

    // O original limita o MTU para estabilidade em mobile.
    const maxJsonSize = 180
    const testChunk = data.slice(0, Math.min(data.length, 10))
    const testPacket = createJsonPacket(dataType, testChunk, 0, 1, '')
    const testJson = JSON.stringify(testPacket)
    const metadata = testJson.length - testPacket.data.length
    const maxRaw = Math.max(1, Math.floor((maxJsonSize - metadata) / (4 / 3)) - 5)
    const total = Math.ceil(data.length / maxRaw)

    try {
      for (let packetIndex = 0; packetIndex < total; packetIndex++) {
        if (abortRef.current) throw new Error('Envio interrompido')

        const offset = packetIndex * maxRaw
        const chunk = data.slice(offset, Math.min(offset + maxRaw, data.length))
        const packet = createJsonPacket(dataType, chunk, packetIndex, total, fileName)
        const bytes = new TextEncoder().encode(JSON.stringify(packet))

        let sucesso = false
        let ultimoErro = null

        for (let tentativa = 0; tentativa < 3 && !sucesso; tentativa++) {
          try {
            const ackPromise = esperarAck(packetIndex + 1)
            await writeRef.current.writeValue(bytes)
            await ackPromise
            sucesso = true
          } catch (error) {
            ultimoErro = error
            limparAck()
            if (tentativa < 2) {
              setRetorno(`ACK não recebido. Tentativa ${tentativa + 2}/3...`)
              await sleep(300)
            }
          }
        }

        if (!sucesso) throw ultimoErro || new Error('Falha no envio')

        setProgresso(Math.round(((packetIndex + 1) / total) * 100))
        await sleep(200)
      }

      setRetorno(`✓ ENVIO CONCLUÍDO — ${total} pacote${total === 1 ? '' : 's'}`)
    } finally {
      limparAck()
      setEnviando(false)
    }
  }

  async function enviar() {
    try {
      const data = prepararDados()
      setRetorno('Enviando ao CT120...')
      await enviarPacotes(modo, data, modo === 'image' ? imagemNome : '')
    } catch (error) {
      setRetorno(`ERRO: ${error.message}`)
      setEnviando(false)
    }
  }

  function pararEnvio() {
    abortRef.current = true
    limparAck()
    setEnviando(false)
    setRetorno('Envio interrompido.')
  }

  function adicionarToken(token) {
    setTexto(prev => prev + token)
    setEditorAberto(false)
  }

  function dateName() {
    const n = Number(dateBlock)
    return n > 0 ? `date${n}` : 'date'
  }

  function addDateTime() {
    adicionarToken('${#31#%' + dateTimeFormat + '%' + dateName() + '}')
  }

  function addDate() {
    let prefix = '#31#%'
    if (calendar !== 'Gregorian') prefix += calendar + '_'
    adicionarToken('${' + prefix + dateFormat + '%' + dateName() + '}')
  }

  function addTime() {
    adicionarToken('${#31#%' + timeFormat + '%' + dateName() + '}')
  }

  function addCounter() {
    const c = counterNum === 'counter' ? 'counter' : `counter${counterNum}`
    let token
    if (counterDigits === 'none') {
      token = thousands ? '${#0T#%d%' + c + '}' : '${%d%' + c + '}'
    } else {
      token = thousands
        ? '${#0T#%0' + counterDigits + 'd%' + c + '}'
        : '${#0#%0' + counterDigits + 'd%' + c + '}'
    }
    adicionarToken(token)
  }

  function clampUdi() {
    let id = parseInt(udiId, 10)
    if (Number.isNaN(id)) id = 0
    return Math.max(0, Math.min(9999, id))
  }

  function selecionarImagem(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const comma = dataUrl.indexOf(',')
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
      setImagemBase64(b64)
      setImagemNome(file.name)
      setPreview(dataUrl)
      setRetorno(`Imagem carregada: ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

  const numeros20 = Array.from({ length: 20 }, (_, i) => String(i + 1))
  const digitos19 = Array.from({ length: 19 }, (_, i) => String(i + 1))

  const conectado = status.startsWith('CT120 CONECTADO')

  function limparConteudo() {
    setTexto('')
    setImagemNome('')
    setImagemBase64('')
    setPreview('')
    setRetorno('')
    setProgresso(0)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <div className="brand-name">LUCENAART</div>
            <div className="brand-tagline">A SUA PRODUÇÃO NÃO PODE PARAR.</div>
          </div>
        </div>
        <div className="product-title">
          <strong>CT120</strong>
          <span>Manager</span>
        </div>
      </header>

      <main className="workspace">
        <section className="hero-card">
          <div className="device-visual" aria-hidden="true">
            <div className="device-screen">CT120</div>
            <div className="device-slot"></div>
          </div>

          <div className="connection-area">
            <div className="connection-title">
              <span className={`status-dot ${conectado ? 'online' : ''}`}></span>
              {conectado ? 'CT120 CONECTADO' : 'CT120 DESCONECTADO'}
            </div>
            <div className="connection-detail">{status}</div>
            <div className="action-row">
              <button className="btn btn-primary btn-connect" onClick={conectarCT120}>
                {conectado ? 'RECONECTAR CT120' : 'PROCURAR DISPOSITIVO'}
              </button>
              <button className="btn btn-danger" onClick={desconectarCT120}>
                DESCONECTAR
              </button>
            </div>
          </div>
        </section>

        <section className="control-card">
          <div className="mode-caption"><strong>TRABALHOS SALVOS</strong></div>

          <div className="input-panel">
            <label>Nome do trabalho</label>
            <input
              value={nomeTrabalho}
              onChange={e => setNomeTrabalho(e.target.value)}
              placeholder="Digite o nome do trabalho"
            />
          </div>

          <div className="input-panel">
            <label>Trabalhos</label>
            <select
              value={trabalhoSelecionado}
              onChange={e => setTrabalhoSelecionado(e.target.value)}
            >
              <option value="">Nenhum trabalho selecionado</option>
              {trabalhos.map(t => <option key={t.nome} value={t.nome}>{t.nome}</option>)}
            </select>
          </div>

          <div className="action-row">
            <button className="btn btn-clear" onClick={novoTrabalho}>NOVO</button>
            <button className="btn btn-primary" onClick={salvarTrabalho}>SALVAR</button>
            <button className="btn btn-success" onClick={abrirTrabalho}>ABRIR</button>
            <button className="btn btn-danger" onClick={excluirTrabalho}>EXCLUIR</button>
            <button className="btn btn-clear" onClick={() => importarRef.current?.click()}>IMPORTAR</button>
            <button className="btn btn-primary" onClick={compartilharTrabalho}>COMPARTILHAR</button>
            <input
              ref={importarRef}
              type="file"
              accept=".json,.ct120.json,application/json,text/json,text/plain"
              onChange={importarTrabalho}
              style={{ display: 'none' }}
            />
          </div>
        </section>

        <section className="control-card">
          <div className="mode-tabs">
            <button className={modo === 'text' ? 'active' : ''} onClick={() => setModo('text')}>
              TEXTO
            </button>
            <button className={modo === 'variable' ? 'active' : ''} onClick={() => setModo('variable')}>
              VARIÁVEL
            </button>
            <button className={modo === 'image' ? 'active' : ''} onClick={() => setModo('image')}>
              IMAGEM
            </button>
          </div>

          <div className="mode-caption">
            Modo selecionado: <strong>{modo === 'text' ? 'TEXTO' : modo === 'variable' ? 'VARIÁVEL' : 'IMAGEM'}</strong>
          </div>

          {modo !== 'image' && (
            <div className="input-panel">
              <label>{modo === 'text' ? 'Texto para impressão' : 'Conteúdo da variável'}</label>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                rows={5}
                placeholder="Digite o conteúdo..."
              />
              <div className="bytes">{new Blob([texto]).size} bytes</div>
            </div>
          )}

          {modo === 'variable' && (
            <button className="btn btn-success btn-full" onClick={() => setEditorAberto(true)}>
              EDITOR DE VARIÁVEIS
            </button>
          )}

          {modo === 'image' && (
            <div className="image-panel">
              <label className="file-picker">
                <span>SELECIONAR IMAGEM</span>
                <input type="file" accept="image/*" onChange={selecionarImagem} />
              </label>
              {preview && <img className="image-preview" src={preview} alt="Prévia da imagem" />}
              {imagemNome && <div className="image-name">{imagemNome}</div>}
            </div>
          )}

          <div className="action-row">
            <button className="btn btn-primary btn-send" disabled={enviando} onClick={enviar}>
              {enviando ? 'ENVIANDO...' : `ENVIAR ${modo === 'text' ? 'TEXTO' : modo === 'variable' ? 'VARIÁVEL' : 'IMAGEM'} AO CT120`}
            </button>
            <button className="btn btn-clear" disabled={enviando} onClick={limparConteudo}>LIMPAR</button>
            {enviando && <button className="btn btn-danger" onClick={pararEnvio}>PARAR</button>}
          </div>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progresso}%` }} />
          </div>

          <div className={`result-box ${retorno.startsWith('ERRO') ? 'error' : retorno.startsWith('✓') ? 'success' : ''}`}>
            {retorno || 'Pronto para enviar.'}
          </div>
        </section>

        <section className="support-card">
          <div>
            <strong>Lucenaart do Brasil</strong>
            <span>Suporte CT120 • Bluetooth BLE</span>
          </div>
          <div className="cotajet">COTAJET</div>
        </section>
      </main>

      {editorAberto && (
        <div className="modal-overlay">
          <div className="variable-modal">
            <div className="modal-head">
              <div>
                <h2>Editor de Variáveis</h2>
                <p>Selecione o tipo e adicione ao conteúdo.</p>
              </div>
              <button className="close-x" onClick={() => setEditorAberto(false)}>×</button>
            </div>

            <div className="editor-tabs">
              <button className={aba === 'datetime' ? 'active' : ''} onClick={() => setAba('datetime')}>Data e Hora</button>
              <button className={aba === 'counter' ? 'active' : ''} onClick={() => setAba('counter')}>Contador</button>
              <button className={aba === 'shift' ? 'active' : ''} onClick={() => setAba('shift')}>Turno</button>
              <button className={aba === 'data' ? 'active' : ''} onClick={() => setAba('data')}>Dados</button>
              <button className={aba === 'udi' ? 'active' : ''} onClick={() => setAba('udi')}>UDI</button>
            </div>

            <div className="editor-body">
              {aba === 'datetime' && (
                <>
                  <h3>Data e Hora</h3>
                  <div className="form-row">
                    <label>Bloco
                      <select value={dateBlock} onChange={e => setDateBlock(e.target.value)}>
                        <option value="0">Hora atual</option>
                        {Array.from({ length: 7 }, (_, i) => String(i + 1)).map(n => <option key={n} value={n}>Bloco {n}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="form-row">
                    <select value={dateTimeFormat} onChange={e => setDateTimeFormat(e.target.value)}>
                      {['dd/MM/yyyy  hh:mm  AP','dd/MM/yyyy  hh:mm  ap','dd/MM/yyyy  hh:mm:ss','dd/MM/yyyy  HH:mm:ss','dd/MM/yyyy  HH:mm','dd-MM-yyyy  hh:mm  AP','dd-MM-yyyy  hh:mm  ap','dd-MM-yyyy  hh:mm:ss','dd-MM-yyyy  HH:mm:ss','dd-MM-yyyy  HH:mm'].map(x => <option key={x}>{x}</option>)}
                    </select>
                    <button className="btn btn-success" onClick={addDateTime}>Adicionar Data/Hora</button>
                  </div>
                  <div className="form-row">
                    <select value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
                      {['dd/MM/yyyy','dd/MM/yy','dd-MM-yyyy','dd-MM-yy','dd.MM.yyyy','dd.MM.yy','MM/yyyy','MM/yy','yyyy','yy','MM','dd'].map(x => <option key={x}>{x}</option>)}
                    </select>
                    <button className="btn btn-success" onClick={addDate}>Adicionar Data</button>
                  </div>
                  <div className="form-row">
                    <select value={timeFormat} onChange={e => setTimeFormat(e.target.value)}>
                      {['hh:mm:ss','HH:mm','hh:mm','HH:mm:ss','HH','mm','ss'].map(x => <option key={x}>{x}</option>)}
                    </select>
                    <button className="btn btn-success" onClick={addTime}>Adicionar Hora</button>
                  </div>
                </>
              )}

              {aba === 'counter' && (
                <>
                  <h3>Contador</h3>
                  <div className="form-row">
                    <select value={counterNum} onChange={e => setCounterNum(e.target.value)}>
                      <option value="counter">counter</option>
                      {numeros20.map(n => <option key={n}>{n}</option>)}
                    </select>
                    <select value={counterDigits} onChange={e => setCounterDigits(e.target.value)}>
                      <option value="none">Nenhum</option>
                      {digitos19.map(n => <option key={n} value={n}>{n} dígitos</option>)}
                    </select>
                    <label className="check-line">
                      <input type="checkbox" checked={thousands} onChange={e => setThousands(e.target.checked)} />
                      Separador de milhares
                    </label>
                  </div>
                  <button className="btn btn-success btn-full" onClick={addCounter}>Adicionar Contador</button>
                </>
              )}

              {aba === 'shift' && (
                <>
                  <h3>Turno</h3>
                  <div className="form-row">
                    <select value={shiftBlock} onChange={e => setShiftBlock(e.target.value)}>
                      {numeros20.map(n => <option key={n}>{n}</option>)}
                    </select>
                    <button className="btn btn-success" onClick={() => adicionarToken('${schedule' + shiftBlock + '}')}>Adicionar Turno</button>
                  </div>
                </>
              )}

              {aba === 'data' && (
                <>
                  <h3>Dados</h3>
                  <div className="form-row">
                    <label>Contador
                      <select value={dataCounter} onChange={e => setDataCounter(e.target.value)}>
                        {numeros20.map(n => <option key={n}>{n}</option>)}
                      </select>
                    </label>
                    <label>Coluna
                      <select value={dataColumn} onChange={e => setDataColumn(e.target.value)}>
                        {['1','2','3','4','5'].map(n => <option key={n}>{n}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="form-row">
                    <button className="btn btn-success" onClick={() => adicionarToken('${%c' + dataCounter + '%xlsx' + dataColumn + '}')}>Adicionar dados XLSX</button>
                    <button className="btn btn-success" onClick={() => adicionarToken('${%txt}')}>Adicionar dados TXT</button>
                  </div>
                </>
              )}

              {aba === 'udi' && (
                <>
                  <h3>UDI</h3>
                  <input type="number" min="0" max="9999" value={udiId} onChange={e => setUdiId(e.target.value)} />
                  <div className="form-row udi-buttons">
                    <button className="btn btn-success" onClick={() => { const id = clampUdi(); adicionarToken('${udi' + id + '}') }}>Adicionar</button>
                    <button className="btn btn-success" onClick={() => { const id = clampUdi(); adicionarToken('${udia' + id + '}') }}>Adicionar GS1</button>
                    <button className="btn btn-success" onClick={() => { const id = clampUdi(); adicionarToken('(' + String(id).padStart(2,'0') + ')' + '${udi' + id + '}') }}>Adicionar (AI)</button>
                    <button className="btn btn-success" onClick={() => { const id = clampUdi(); adicionarToken('[' + String(id).padStart(2,'0') + ']' + '${udi' + id + '}') }}>Adicionar [AI]</button>
                    <button className="btn btn-success" onClick={() => adicionarToken('${udia0}')}>Gerar UDI DM</button>
                  </div>
                </>
              )}
            </div>

            <button className="btn btn-danger btn-full" onClick={() => setEditorAberto(false)}>FECHAR</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
