import { organizarLeitura } from './organizarLeitura.mjs'
import EditorImagem from './EditorImagem.jsx'
import {Icones} from './Codigos.jsx'
import GeradorCodigos from './GeradorCodigos.jsx'
import TesteImpressao from './TesteImpressao.jsx'
import { useEffect, useRef, useState } from 'react'
import { BleClient } from '@capacitor-community/bluetooth-le'
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner'
import './App.css'

const SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb'
const NOTIFY_UUID  = '0000fff1-0000-1000-8000-00805f9b34fb'
const WRITE_UUID   = '0000fff2-0000-1000-8000-00805f9b34fb'

const RELE_NAME = 'LUCENAART-PRINT'
const RELE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb'
const RELE_WRITE_UUID = '0000fff2-0000-1000-8000-00805f9b34fb'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const iconPaths = {"save": "M4 3h14l3 3v15H3V3h1 M7 3v7h10V3 M7 21v-8h10v8", "folder": "M3 6h7l2 3h9v11H3z", "send": "M3 10l18-7-7 18-4-8z M10 13L21 3", "trash": "M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7", "texto": "M5 5h14 M12 5v14 M8 19h8 M5 5v3 M19 5v3", "variaveis": "M9 3H7l-1 7-3 2 3 2 1 7h2 M15 3h2l1 7 3 2-3 2-1 7h-2", "codigos": "M3 4v16 M6 4v16 M10 4v16 M12 4v16 M16 4v16 M21 4v16", "imagens": "M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M7 7h2v2H7z", "grid": "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z", "novo": "M5 3h10l4 4v7 M5 3v18h8 M15 3v5h4 M8 12h7 M18 15v8 M14 19h8", "printer": "M6 8V3h12v5 M6 17H3V8h18v9h-3 M6 14h12v7H6z M17 11h1"}
function Icon({name}) { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name] || iconPaths.grid}/></svg> }

function App() {
  const [qr, setQr] = useState(null)
  function revisarQr(n) {
    setQr({...qr, etapa:'revisar', linhas:n, texto:organizarLeitura(qr.original,n)})
  }
  useEffect(() => { document.title = "CT 120 Destroyer" }, [])
  const [efeito, setEfeito] = useState("")
  const [fonteEfeito, setFonteEfeito] = useState("Arial")
  const [boldE,setBoldE]=useState(false),[italicE,setItalicE]=useState(false),[sizeE,setSizeE]=useState(64),[strokeE,setStrokeE]=useState(1),[marginE,setMarginE]=useState(6),[extraMenu,setExtraMenu]=useState(''),[fonts,setFonts]=useState(()=>{try{return JSON.parse(localStorage.getItem('ct-fonts')||'[]')}catch{return []}})
  useEffect(()=>{fonts.forEach(async f=>{try{const face=await new FontFace(f.name,`url(${f.data})`).load();document.fonts.add(face)}catch{}})},[fonts])
  async function importFont(e){const f=e.target.files?.[0];if(!f)return;try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f)});const name='CTFont'+Date.now();const face=await new FontFace(name,`url(${data})`).load();document.fonts.add(face);const next=[...fonts,{name,label:f.name,data}];localStorage.setItem('ct-fonts',JSON.stringify(next));setFonts(next);setFonteEfeito(name)}catch{setRetorno('Não foi possível importar a fonte.')}e.target.value=''}
  const [status, setStatus] = useState('Desconectado')
  const [texto, setTexto] = useState('')
  const [painel, setPainel] = useState('texto')
  const [modo, setModo] = useState('text')
  const [retorno, setRetorno] = useState('')
  const [editorAberto, setEditorAberto] = useState(false)
  const [etapaVariavel, setEtapaVariavel] = useState({ tipo: 'menu' })
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [origemEfeito, setOrigemEfeito] = useState(null)
  const [imagemParaEditar, setImagemParaEditar] = useState(null)
  const [imagemNome, setImagemNome] = useState('')
  const [imagemBase64, setImagemBase64] = useState('')
  const [preview, setPreview] = useState('')
  const [nomeTrabalho, setNomeTrabalho] = useState('')
  const [trabalhos, setTrabalhos] = useState([])
  const [trabalhoSelecionado, setTrabalhoSelecionado] = useState('')
  const importarRef = useRef(null)
  const bmpCatalogoRef = useRef(null)
  const [codigoBmp, setCodigoBmp] = useState('')
  const [resultadoCodigoBmp, setResultadoCodigoBmp] = useState('Exemplo de teste: 040.346.593.592-02 → AFT 484.bmp')
  const [codigoDaPrevia, setCodigoDaPrevia] = useState('')
  const [lendoCodigo, setLendoCodigo] = useState(false)


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
      if (origemEfeito) trabalho.origemEfeito = origemEfeito
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
    setOrigemEfeito(tipo === 'image' && typeof trabalho.origemEfeito?.texto === 'string' ? trabalho.origemEfeito : null)
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
    setPainel(tipo === 'variable' ? 'variaveis' : tipo === 'text' ? 'texto' : 'imagens')
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

  const [udiId, setUdiId] = useState('')
  const editorBotaoRef = useRef(null)
  const dialogoRef = useRef(null)

  useEffect(() => {
    if (!editorAberto) return
    const dialogo = dialogoRef.current
    dialogo?.querySelector('button, input')?.focus()
    const rolagemAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = rolagemAnterior
    }
  }, [editorAberto, etapaVariavel])

  function fecharEditor() {
    setEditorAberto(false)
    editorBotaoRef.current?.focus()
  }

  const deviceRef = useRef(null)
  const writeRef = useRef(null)
  const notifyRef = useRef(null)
  const ackResolverRef = useRef(null)
  const ackTimerRef = useRef(null)
  const expectedAckRef = useRef(-1)
  const abortRef = useRef(false)

  // Relé de impressão — conexão independente do CT120.
  const releDeviceRef = useRef(null)
  const [releConectado, setReleConectado] = useState(false)
  const [releOcupado, setReleOcupado] = useState(false)

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

  const conectandoCT120 = useRef(false)

  async function conectarCT120() {
    if (conectandoCT120.current || enviando) return
    conectandoCT120.current = true
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
    } finally {
      conectandoCT120.current = false
    }
  }

  async function conectarRele() {
    await BleClient.initialize()

    setRetorno(`Procurando ${RELE_NAME}...`)

    // Busca automática no iPhone, sem abrir a lista de dispositivos.
    let device = null
    let timer = null
    try {
      device = await new Promise(async (resolve, reject) => {
        let concluido = false
        const finalizar = (resultado, erro) => {
          if (concluido) return
          concluido = true
          if (timer) clearTimeout(timer)
          if (erro) reject(erro)
          else resolve(resultado)
        }

        timer = setTimeout(() => finalizar(null), 10000)
        try {
          await BleClient.requestLEScan({ allowDuplicates: false }, result => {
            const encontrado = result?.device
            const nome = encontrado?.name || result?.localName || ''
            if (nome.trim().toUpperCase() === RELE_NAME) {
              finalizar(encontrado)
            }
          })
        } catch (erro) {
          finalizar(null, erro)
        }
      })
    } catch (erro) {
      setRetorno(`Busca automática indisponível: ${erro?.message || String(erro)}`)
    } finally {
      if (timer) clearTimeout(timer)
      try { await BleClient.stopLEScan() } catch { /* busca já encerrada */ }
    }

    // Alternativa manual caso a busca automática não encontre a placa.
    if (!device) {
      setRetorno(`${RELE_NAME} não encontrado automaticamente. Selecione na lista.`)
      device = await BleClient.requestDevice({
        optionalServices: [RELE_SERVICE_UUID]
      })
    }

    setRetorno(`${device.name || RELE_NAME} encontrado. Conectando...`)

    await BleClient.connect(device.deviceId, () => {
      releDeviceRef.current = null
      setReleConectado(false)
      setRetorno('Controle de impressão desconectado.')
    })

    releDeviceRef.current = device
    setReleConectado(true)
    setRetorno(`✓ ${device.name || RELE_NAME} conectado — FFF0 / FFF2 pronto.`)

    return device
  }

  async function imprimirPeloRele() {
    if (releOcupado) return

    setReleOcupado(true)

    try {
      let device = releDeviceRef.current

      if (!device?.deviceId) {
        device = await conectarRele()
      }

      // Comando confirmado no módulo real: "IMPRIMIR " com espaço final.
      const bytes = new TextEncoder().encode('IMPRIMIR ')
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

      await BleClient.write(
        device.deviceId,
        RELE_SERVICE_UUID,
        RELE_WRITE_UUID,
        view
      )

      setRetorno('✓ Comando de impressão enviado.')
    } catch (error) {
      releDeviceRef.current = null
      setReleConectado(false)
      setRetorno(`ERRO NA IMPRESSÃO: ${error?.message || String(error)}`)
    } finally {
      setReleOcupado(false)
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
            if (abortRef.current) throw new Error('Envio interrompido')
            if (tentativa < 2) {
              setRetorno(`ACK não recebido. Tentativa ${tentativa + 2}/3...`)
              await sleep(300)
            }
          }
        }

        if (!sucesso) throw ultimoErro || new Error('Falha no envio')

        if (abortRef.current) throw new Error('Envio interrompido')
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
      if (modo === 'image' && codigoDaPrevia && codigoDaPrevia !== codigoBmp.trim()) {
        limparBmpDaPrevia()
        setResultadoCodigoBmp('Código alterado. Toque em LOCALIZAR BMP.')
        throw new Error('Localize o BMP do código atual antes de enviar.')
      }
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
    const ackPendente = ackResolverRef.current
    limparAck()
    ackPendente?.reject(new Error('Envio interrompido'))
    setEnviando(false)
    setRetorno('Envio interrompido.')
  }

  function adicionarToken(token) {
    setTexto(prev => prev + token)
    fecharEditor()
  }

  function listaVariaveis() {
    const etapa = etapaVariavel
    const numeros = Array.from({ length: 20 }, (_, i) => i + 1)
    const ir = tipo => setEtapaVariavel({ tipo })
    const escolherFormato = formatos => formatos.map(formato => ({
      rotulo: formato,
      escolher: () => setEtapaVariavel({ tipo: 'bloco', formato }),
    }))

    switch (etapa.tipo) {
      case 'menu':
        return { titulo: 'Editor de Variáveis', itens: [
          { rotulo: 'Data e Hora', escolher: () => ir('dataHora') },
          { rotulo: 'Contador', escolher: () => ir('contador') },
          { rotulo: 'Turno', escolher: () => ir('turno') },
          { rotulo: 'Dados', escolher: () => ir('dados') },
          { rotulo: 'UDI', escolher: () => { setUdiId(''); ir('udi') } },
        ] }
      case 'dataHora':
        return { titulo: 'Data e Hora', itens: [
          { rotulo: 'Data e Hora', escolher: () => ir('formatoDataHora') },
          { rotulo: 'Data', escolher: () => ir('formatoData') },
          { rotulo: 'Hora', escolher: () => ir('formatoHora') },
        ] }
      case 'formatoDataHora':
        return { titulo: 'Data e Hora', itens: escolherFormato([
          'dd/MM/yyyy  hh:mm  AP', 'dd/MM/yyyy  hh:mm  ap',
          'dd/MM/yyyy  hh:mm:ss', 'dd/MM/yyyy  HH:mm:ss', 'dd/MM/yyyy  HH:mm',
          'dd-MM-yyyy  hh:mm  AP', 'dd-MM-yyyy  hh:mm  ap',
          'dd-MM-yyyy  hh:mm:ss', 'dd-MM-yyyy  HH:mm:ss', 'dd-MM-yyyy  HH:mm',
        ]) }
      case 'formatoData':
        return { titulo: 'Data', itens: escolherFormato([
          'dd/MM/yyyy', 'dd/MM/yy', 'dd-MM-yyyy', 'dd-MM-yy',
          'dd.MM.yyyy', 'dd.MM.yy', 'MM/yyyy', 'MM/yy', 'yyyy', 'yy', 'MM', 'dd',
        ]) }
      case 'formatoHora':
        return { titulo: 'Hora', itens: escolherFormato([
          'hh:mm:ss', 'HH:mm', 'hh:mm', 'HH:mm:ss', 'HH', 'mm', 'ss',
        ]) }
      case 'bloco':
        return { titulo: 'Bloco de data/hora', itens: Array.from({ length: 8 }, (_, n) => ({
          rotulo: n === 0 ? 'Hora atual' : 'Bloco ' + n,
          escolher: () => adicionarToken('${#31#%' + etapa.formato + '%' + (n === 0 ? 'date' : 'date' + n) + '}'),
        })) }
      case 'contador':
        return { titulo: 'Contador', itens: ['counter', ...numeros].map(n => ({
          rotulo: String(n),
          escolher: () => setEtapaVariavel({ tipo: 'digitos', contador: n === 'counter' ? n : 'counter' + n }),
        })) }
      case 'digitos':
        return { titulo: 'Dígitos', itens: Array.from({ length: 7 }, (_, n) => ({
          rotulo: n === 0 ? 'Sem formato' : n + (n === 1 ? ' dígito' : ' dígitos'),
          escolher: () => adicionarToken(n === 0
            ? '${%d%' + etapa.contador + '}'
            : '${#0#%0' + n + 'd%' + etapa.contador + '}'),
        })) }
      case 'turno':
        return { titulo: 'Bloco de turno', itens: numeros.map(n => ({
          rotulo: 'Turno ' + n,
          escolher: () => adicionarToken('${schedule' + n + '}'),
        })) }
      case 'dados':
        return { titulo: 'Dados', itens: [
          { rotulo: 'Dados XLSX', escolher: () => ir('contadorXlsx') },
          { rotulo: 'Dados TXT', escolher: () => adicionarToken('${%txt}') },
        ] }
      case 'contadorXlsx':
        return { titulo: 'Contador XLSX', itens: numeros.map(n => ({
          rotulo: 'Contador ' + n,
          escolher: () => setEtapaVariavel({ tipo: 'coluna', contador: n }),
        })) }
      case 'coluna':
        return { titulo: 'Coluna', itens: numeros.map(n => ({
          rotulo: 'Coluna ' + n,
          escolher: () => adicionarToken('${%c' + etapa.contador + '%xlsx' + n + '}'),
        })) }
      case 'udi':
        return { titulo: 'UDI', itens: [] }
      default:
        return { titulo: 'Editor de Variáveis', itens: [] }
    }
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

  // =========================================================
  // CÓDIGO DE BARRAS / QR CODE → BMP — catálogo local
  // =========================================================
  const CODIGO_TESTE = '040.346.593.592-02'
  const CATALOGO_BMP_KEY = 'catalogo_codigo_bmp_v1'
  const LIMITE_BMP_BYTES = 10 * 1024 * 1024

  function carregarCatalogoBmp() {
    try {
      const catalogo = JSON.parse(localStorage.getItem(CATALOGO_BMP_KEY) || '{}')
      return catalogo && typeof catalogo === 'object' && !Array.isArray(catalogo) ? catalogo : {}
    } catch {
      return {}
    }
  }

  function salvarCatalogoBmp(catalogo) {
    localStorage.setItem(CATALOGO_BMP_KEY, JSON.stringify(catalogo))
  }

  function base64ParaBytes(base64) {
    const binario = atob(base64)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
    return bytes
  }

  function validarBmpBase64(base64) {
    const bytes = base64ParaBytes(base64)
    if (bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
      throw new Error('Selecione um arquivo BMP válido.')
    }
    if (bytes.length > LIMITE_BMP_BYTES) throw new Error('BMP maior que 10 MB.')
    return bytes
  }

  function mostrarBmpCatalogo(nome, base64, codigo = '') {
    setOrigemEfeito(null)
    validarBmpBase64(base64)
    setModo('image')
    setImagemNome(nome)
    setImagemBase64(base64)
    setPreview(`data:image/bmp;base64,${base64}`)
    setCodigoDaPrevia(codigo)
    setProgresso(0)
  }

  function limparBmpDaPrevia() {
    setOrigemEfeito(null)
    setCodigoDaPrevia('')
    setImagemNome('')
    setImagemBase64('')
    setPreview('')
    setProgresso(0)
  }

  function alterarCodigoBmp(valor) {
    const novo = valor
    if (codigoDaPrevia && codigoDaPrevia !== novo.trim() && !enviando) {
      limparBmpDaPrevia()
      setResultadoCodigoBmp('Código alterado. Toque em LOCALIZAR BMP.')
    }
    setCodigoBmp(novo)
  }

  function buscarCodigoBmp(codigoForcado = '') {
    if (enviando) {
      setRetorno('Pare o envio antes de trocar a imagem.')
      return
    }
    const chave = (codigoForcado || codigoBmp).trim()
    if (!chave) {
      setRetorno('Leia ou digite o código primeiro.')
      return
    }

    limparBmpDaPrevia()
    try {
      const catalogo = carregarCatalogoBmp()
      const registro = catalogo[chave]

      if (!registro) {
        setResultadoCodigoBmp(`Nenhum BMP cadastrado para ${chave}.`)
        setRetorno('Selecione o BMP correto e toque em VINCULAR BMP.')
        return
      }

      validarBmpBase64(registro.base64)
      mostrarBmpCatalogo(registro.nome, registro.base64, chave)
      setResultadoCodigoBmp(`${chave} → ${registro.nome}`)
      setRetorno(`✓ ${chave} → ${registro.nome}`)
    } catch (error) {
      limparBmpDaPrevia()
      setResultadoCodigoBmp(`Não foi possível carregar o BMP de ${chave}.`)
      setRetorno(`ERRO: ${error?.message || String(error)}`)
    }
  }

  async function lerCodigoBmp() {
    if (enviando || lendoCodigo) return
    setLendoCodigo(true)
    try {
      const leitura = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.ALL,
        scanInstructions: 'Aponte a câmera para o código de barras ou QR Code'
      })
      const chave = String(leitura?.ScanResult || '').trim()
      if (!chave) return
      setCodigoBmp(chave)
      buscarCodigoBmp(chave)
    } catch (error) {
      const mensagem = error?.message || String(error)
      if (!/cancel/i.test(mensagem)) setRetorno(`ERRO NO LEITOR: ${mensagem}`)
    } finally {
      setLendoCodigo(false)
    }
  }

  const [abaCodigo,setAbaCodigo] = useState('vincular')
  const [codigoCopiado,setCodigoCopiado] = useState(null)
  const arquivoVinculo = useRef(null)

  async function salvarArquivoVinculado(event) {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    const chave = codigoBmp.trim()
    if (!arquivo || !chave || enviando) return
    try {
      if (arquivo.size > LIMITE_BMP_BYTES) throw Error('BMP maior que 10 MB.')
      const bytes = new Uint8Array(await arquivo.arrayBuffer())
      const partes = []
      for (let i=0;i<bytes.length;i+=8192) partes.push(String.fromCharCode(...bytes.subarray(i,i+8192)))
      const base64 = btoa(partes.join(''))
      validarBmpBase64(base64)
      const catalogo = carregarCatalogoBmp()
      if (Object.hasOwn(catalogo,chave) && !window.confirm('Substituir o vínculo existente?')) return
      salvarCatalogoBmp({...catalogo,[chave]:{nome:arquivo.name,base64}})
      mostrarBmpCatalogo(arquivo.name,base64,chave)
      setResultadoCodigoBmp('Vínculo salvo: '+chave+' → '+arquivo.name)
    } catch (error) {setResultadoCodigoBmp(error.message)}
  }

  function excluirVinculo() {
    const chave = codigoBmp.trim()
    const catalogo = carregarCatalogoBmp()
    if (!chave || !Object.hasOwn(catalogo,chave)) {
      setResultadoCodigoBmp('Nenhum vínculo salvo para esse código.')
      return
    }
    if (!window.confirm('Excluir vínculo de '+chave+'?')) return
    try {
      delete catalogo[chave]
      salvarCatalogoBmp(catalogo)
      setResultadoCodigoBmp('Vínculo excluído.')
    } catch(error) {setResultadoCodigoBmp(error.message)}
  }

  function selecionarBmpCatalogo(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result)
        const comma = dataUrl.indexOf(',')
        const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
        validarBmpBase64(b64)
        mostrarBmpCatalogo(file.name, b64)
        setResultadoCodigoBmp(`BMP selecionado: ${file.name}. Digite o código e toque em VINCULAR BMP.`)
        setRetorno(`Imagem selecionada: ${file.name}`)
      } catch (error) {
        limparBmpDaPrevia()
        setResultadoCodigoBmp('Imagem não carregada.')
        setRetorno(`ERRO: ${error?.message || String(error)}`)
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  const dialogoVariavel = listaVariaveis()

  const conectado = status.startsWith('CT120 CONECTADO')

  function limparConteudo() {
    setOrigemEfeito(null)
    setCodigoDaPrevia('')
    setTexto('')
    setImagemNome('')
    setImagemBase64('')
    setPreview('')
    setRetorno('')
    setProgresso(0)
  }

  function encodeIndustrialBmp(c) {
    const w=c.width,h=c.height,stride=Math.ceil(w/32)*4;
    const b=new Uint8Array(62+stride*h),v=new DataView(b.buffer),d=c.getContext('2d').getImageData(0,0,w,h).data;
    b[0]=66;b[1]=77;v.setUint32(2,b.length,true);v.setUint32(10,62,true);v.setUint32(14,40,true);v.setInt32(18,w,true);v.setInt32(22,h,true);v.setUint16(26,1,true);v.setUint16(28,1,true);v.setUint32(34,stride*h,true);v.setUint32(46,2,true);b.set([255,255,255,0],58);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4]>127)b[62+(h-1-y)*stride+(x>>3)]|=128>>(x%8);
    return b
  }
  function bitmapIndustrial(c,nome,painelDestino='area') {
    let raw='';for(const byte of encodeIndustrialBmp(c))raw+=String.fromCharCode(byte);
    mostrarBmpCatalogo(nome,btoa(raw));setPreview(c.toDataURL());setPainel(painelDestino);
  }
  const effectCanvas = useRef(null)
  const [effectFits, setEffectFits] = useState(false)

  useEffect(() => {
    if (!efeito || !effectCanvas.current) return
    const canvas = effectCanvas.current
    const ctx = canvas.getContext('2d', {willReadFrequently:true})
    let cancelled = false

    function draw() {
      if (cancelled) return
      if (!texto.trim()) {
        canvas.width = canvas.height = 1
        setEffectFits(false)
        return
      }
      const lines = texto.split(/\r?\n/)
      const padding = marginE + (efeito === 'vazado' ? Math.ceil(strokeE / 2) : 0)
      const font = size => `${italicE ? 'italic ' : ''}${boldE ? 'bold ' : ''}${size}px ${fonteEfeito}`
      let size = sizeE
      let layout
      for (; size >= 8; size--) {
        ctx.font = font(size)
        ctx.textBaseline = 'alphabetic'
        const metrics = lines.map(line => ctx.measureText(line))
        const left = Math.max(0, ...metrics.map(m => m.actualBoundingBoxLeft || 0))
        const right = Math.max(1, ...metrics.map(m => Math.max(m.width, m.actualBoundingBoxRight || 0)))
        const ascent = Math.max(size, ...metrics.map(m => m.actualBoundingBoxAscent || 0))
        const descent = Math.max(Math.ceil(size * .2), ...metrics.map(m => m.actualBoundingBoxDescent || 0))
        const step = Math.ceil(ascent + descent)
        const width = Math.ceil(left + right) + 2 * padding
        const height = step * lines.length + 2 * padding
        if (width <= 480 && height <= 240) {
          layout = {left, ascent, step, width, height}
          break
        }
      }
      setEffectFits(Boolean(layout))
      if (!layout) {
        canvas.width = canvas.height = 1
        return
      }
      const {left, ascent, step, width, height} = layout
      canvas.width = width
      canvas.height = height
      ctx.fillStyle = efeito === 'negativo' ? 'black' : 'white'
      ctx.fillRect(0, 0, width, height)
      ctx.font = font(size)
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = efeito === 'negativo' ? 'white' : 'black'
      ctx.strokeStyle = 'black'
      ctx.lineWidth = strokeE
      ctx.lineJoin = 'round'
      lines.forEach((line, index) => {
        const y = padding + ascent + index * step
        if (efeito === 'vazado') ctx.strokeText(line, padding + left, y)
        else ctx.fillText(line, padding + left, y)
      })
      const pixels = ctx.getImageData(0, 0, width, height)
      for (let i = 0; i < pixels.data.length; i += 4) {
        const value = pixels.data[i] >= 128 ? 255 : 0
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value
      }
      ctx.putImageData(pixels, 0, 0)
    }

    draw()
    document.fonts?.ready.then(draw)
    return () => { cancelled = true }
  }, [texto, efeito, fonteEfeito, boldE, italicE, sizeE, strokeE, marginE])

  function aplicarEfeito() {
    if (!effectFits || !effectCanvas.current) return
    bitmapIndustrial(effectCanvas.current, 'texto-efeito.bmp')
    setOrigemEfeito({ texto, efeito, fonteEfeito, boldE, italicE, sizeE, strokeE, marginE })
    setEfeito('')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <img className="brand-logo" src="/logo-lucenaart.jpg" alt="Lucenaart do Brasil"
          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.hidden = false }} />
        <div className="brand-fallback" hidden>LUCENAART <small>DO BRASIL</small></div>
        <div className="product-title">CT 120 Destroyer</div>
        <div className="brand-tagline">A SUA PRODUÇÃO NÃO PODE PARAR</div>
      </header>
      <main className="workspace">
        <div className={`connection-status ${conectado ? 'online' : ''}`}>
          <span aria-hidden="true">● </span><span role="status" style={{fontSize:'inherit'}}>{status}</span>
          {!conectado && (status === 'Desconectado' || status.startsWith('Erro:')) &&
            <> <span aria-hidden="true">•</span> <button type="button" disabled={enviando}
              onClick={conectarCT120}
              style={{background:'none',border:0,color:'inherit',font:'inherit',minHeight:44,cursor:'pointer'}}>
              TOQUE PARA CONECTAR
            </button></>}
        </div>
        <section className="work-area">
          <h2>ÁREA DE TRABALHO</h2>
          <div className="work-preview">{modo === 'image' ? (preview ? <img src={preview} alt="Prévia" /> : 'Selecione uma imagem') : (texto || 'Novo trabalho • Digite um texto ou gere um código')}</div>
          {modo === 'image' && preview && <button className="btn btn-full" disabled={enviando} onClick={() => {
            if (origemEfeito) {
              setTexto(origemEfeito.texto)
              setFonteEfeito(origemEfeito.fonteEfeito)
              setBoldE(origemEfeito.boldE)
              setItalicE(origemEfeito.italicE)
              setSizeE(origemEfeito.sizeE)
              setStrokeE(origemEfeito.strokeE)
              setMarginE(origemEfeito.marginE)
              setEfeito(origemEfeito.efeito)
            } else {
              setImagemParaEditar({ preview, nome: imagemNome })
              setPainel('imagens')
            }
          }}>{origemEfeito ? 'EDITAR TEXTO' : 'EDITAR IMAGEM'}</button>}
        </section>
        {['texto','variaveis','icones'].includes(painel) && (        <section className="content-section">
          <h2>{painel.toUpperCase()}</h2>
          {['texto','variaveis'].includes(painel) && (
            <div className="input-panel">
              <label htmlFor="conteudo">Conteúdo</label>
              <textarea id="conteudo" value={texto} onChange={e => setTexto(e.target.value)}
                disabled={enviando} rows={5} wrap="off"
                style={{ whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' }}
                placeholder="Digite o conteúdo para o CT120" />
              {painel==='texto' && <button className="btn btn-full" disabled={enviando} onClick={()=>setEfeito('normal')}>EFEITOS DE TEXTO</button>}
              <div className="edit-actions"><button className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(texto)}catch{setRetorno('Não foi possível copiar.')}}}>Copiar</button><button className="btn" disabled={enviando} onClick={async()=>{try{setTexto(await navigator.clipboard.readText())}catch{setRetorno('Use a opção Colar do teclado.')}}}>Colar</button><button className="btn" disabled={enviando} onClick={()=>setTexto('')}>Remover</button><button className="btn" onClick={()=>setPainel('area')}>Voltar</button></div>
            </div>
          )}
          {painel === 'variaveis' && (
            <button className="btn btn-full" disabled={enviando} ref={editorBotaoRef} onClick={() => { setEtapaVariavel({ tipo: 'menu' }); setEditorAberto(true) }}>EDITOR DE VARIÁVEIS</button>
          )}
          {painel==='icones' && <Icones onSymbol={v=>{setTexto(t=>t+v);setModo('text');setPainel('texto')}} onBitmap={bitmapIndustrial} disabled={enviando} onBack={()=>setPainel('area')}/>}
        </section>)}
        <section className="work-controls">          <div className="work-actions">
           <button className="btn save" disabled={enviando} onClick={() => { if(nomeTrabalho.trim()) salvarTrabalho(); else setPainel('trabalhos') }}><Icon name="save"/>SALVAR</button>
           <button className="btn" disabled={enviando} onClick={() => setPainel('trabalhos')}><Icon name="folder"/>ABRIR</button>
           <button className="btn" disabled={enviando || !conectado} onClick={enviar}><Icon name="send"/>ENVIAR</button>
           <button className="btn clear" disabled={enviando} onClick={limparConteudo}><Icon name="trash"/>LIMPAR</button>
          </div>
          <button className="btn stop" disabled={!enviando} onClick={pararEnvio}>Parar envio</button>
          <div className="progress-label">{enviando ? "ENVIANDO" : "AGUARDANDO ENVIO"} • {progresso}%</div><progress max="100" value={progresso} />
        </section>
        <nav className="nav-grid">{[['texto','texto','TEXTO'],['variaveis','variaveis','VARIÁVEIS'],['codigos','codigos','CÓDIGOS'],['imagens','imagens','IMAGENS'],['icones','grid','ÍCONES'],['area','grid','ÁREA'],['trabalhos','folder','TRABALHOS'],['novo','novo','NOVO'],['mais','grid','MAIS'],['bluetooth','printer','DATADOR']].map(([id,icone,nome]) => <button key={id} className={'btn '+(painel===id?'selected':'')} disabled={enviando} onClick={()=>{if(id==='novo'){novoTrabalho();setPainel('texto');return}setPainel(id);if(id==='texto')setModo('text');if(id==='variaveis')setModo('variable');if(id==='imagens')setModo('image')}}><Icon name={icone}/>{nome}</button>)}</nav>
        {painel==='codigos' && <section className="content-section">
          <div className="edit-actions">
            <button className="btn" onClick={()=>setAbaCodigo('gerar')}>Gerar</button>
            <button className="btn" onClick={()=>setAbaCodigo('vincular')}>Vincular BMP</button>
            <button className="btn" disabled={enviando||lendoCodigo} onClick={async()=>{
              setLendoCodigo(true)
              try {
                const leitura=await CapacitorBarcodeScanner.scanBarcode({hint:CapacitorBarcodeScannerTypeHint.ALL,scanInstructions:'Aponte a câmera para um código de barras ou 2D'})
                if (leitura?.ScanResult) {
                  setTexto(leitura.ScanResult)
                  setModo('text')
                  setPainel('texto')
                  setQr({etapa:'original', original:leitura.ScanResult})
                }
              } catch(error) {if(!/cancel/i.test(String(error.message||error)))setRetorno(String(error.message||error))}
              finally {setLendoCodigo(false)}
            }}>Leitor</button>
          </div>
          {abaCodigo==='gerar' ? <GeradorCodigos disabled={enviando} onBack={()=>setPainel('area')}
            onCopy={(canvas,nome)=>{
              const copia=document.createElement('canvas')
              copia.width=canvas.width;copia.height=canvas.height
              copia.getContext('2d').drawImage(canvas,0,0)
              setCodigoCopiado({canvas:copia,nome})
            }}/> : <div style={{marginTop:16}}>
            <strong>CÓDIGO DE BARRAS / QR CODE → BMP</strong>
            <input aria-label="Código para vincular" placeholder="Leia ou digite o código" value={codigoBmp} onChange={e=>alterarCodigoBmp(e.target.value)} disabled={enviando}/>
            <div className="edit-actions">
              <button className="btn" disabled={enviando||lendoCodigo} onClick={lerCodigoBmp}>LER CÓDIGO</button>
              <button className="btn" disabled={enviando} onClick={excluirVinculo}>EXCLUIR VÍNCULO</button>
            </div>
            <input ref={arquivoVinculo} type="file" accept=".bmp,image/bmp,image/x-ms-bmp" hidden onChange={salvarArquivoVinculado}/>
            <button className="btn btn-full" disabled={enviando||lendoCodigo} onClick={()=>{
              if(!codigoBmp.trim()){setResultadoCodigoBmp('Leia ou digite o código primeiro.');return}
              arquivoVinculo.current?.click()
            }}>VINCULAR BMP AO CÓDIGO</button>
            <p role="status">{resultadoCodigoBmp}</p>
          </div>}
        </section>}
        {painel==='area' && codigoCopiado && <button className="btn btn-full" disabled={enviando}
          onClick={()=>{bitmapIndustrial(codigoCopiado.canvas,codigoCopiado.nome);setCodigoCopiado(null)}}>COLAR CÓDIGO</button>}

        {painel==='imagens' && <section className="content-section">
          <input ref={bmpCatalogoRef} type="file" accept=".bmp,image/bmp,image/x-ms-bmp"
            disabled={enviando} onChange={selecionarBmpCatalogo} hidden/>
          <EditorImagem imagemParaEditar={imagemParaEditar} onEditStart={() => setImagemParaEditar(null)}
            onBitmap={bitmapIndustrial} encodeBitmap={encodeIndustrialBmp}
            onSelectBmp={()=>bmpCatalogoRef.current?.click()} preview={preview} disabled={enviando}/>
        </section>}
        {painel==='icones' && <section><h2>ÍCONES</h2><p>Biblioteca de impressão será incorporada na próxima etapa.</p></section>}
        {painel==='trabalhos' && (        <section className="jobs-section">
          <h2>TRABALHOS SALVOS</h2>
          <input aria-label="Nome do trabalho" type="text" value={nomeTrabalho}
            onChange={e => setNomeTrabalho(e.target.value)} placeholder="Nome do trabalho" disabled={enviando} />
          <select aria-label="Trabalhos salvos" value={trabalhoSelecionado}
            onChange={e => setTrabalhoSelecionado(e.target.value)} disabled={enviando}>
            <option value="">Selecione um trabalho</option>
            {trabalhos.map(t => <option key={t.nome} value={t.nome}>{t.nome}</option>)}
          </select>
          <div className="job-buttons">
            <button className="btn" disabled={enviando} onClick={novoTrabalho}>NOVO</button>
            <button className="btn" disabled={enviando} onClick={salvarTrabalho}>SALVAR</button>
            <button className="btn" disabled={enviando} onClick={abrirTrabalho}>ABRIR</button>
            <button className="btn" disabled={enviando} onClick={excluirTrabalho}>EXCLUIR</button>
            <button className="btn" disabled={enviando} onClick={() => importarRef.current?.click()}>IMPORTAR</button>
            <button className="btn share-button" disabled={enviando} onClick={compartilharTrabalho}>COMPARTILHAR</button>
          </div>
          <input ref={importarRef} type="file" accept=".json,.ct120.json,application/json,text/json,text/plain"
            onChange={importarTrabalho} style={{ display: 'none' }} />
        </section>)}
        {painel==='bluetooth' && (<>        <section className="connection-section">
          <h2>CONEXÃO</h2>
          <div className={`connection-status ${conectado ? 'online' : ''}`} role="status">
            <span aria-hidden="true">●</span> {status}
          </div>
          <div className="connection-buttons">
            <button className="btn" onClick={conectarCT120} disabled={enviando}>PROCURAR DISPOSITIVO</button>
            <button className="btn" onClick={desconectarCT120} disabled={enviando}>DESCONECTAR</button>
          </div>
        </section>        <section className="print-section">
          <h2>CONTROLE DE IMPRESSÃO</h2>
          <button
            className="btn btn-full print-button"
            onClick={imprimirPeloRele}
            disabled={releOcupado}
            title="Iniciar impressão via Bluetooth"
          >
            {releOcupado ? 'CONECTANDO...' : '▶ INICIAR IMPRESSÃO'}
          </button>
          <div className={`relay-status ${releConectado ? 'online' : ''}`}>
            {releConectado ? '● IMPRESSÃO CONECTADA' : '● IMPRESSÃO DESCONECTADA'}
          </div>
        </section></>)}
        {painel==='area' && <section><h2>ÁREA DE TRABALHO</h2><div className="result-box">{imagemNome || texto || 'Nenhum conteúdo'}</div></section>}
        {painel==='mais' && (        <section className="log-section">
          <div className="more-tools">
            <button className="btn" onClick={()=>setExtraMenu('links')}>VÍNCULOS SALVOS</button>
            <TesteImpressao onBitmap={bitmapIndustrial} disabled={enviando}/>
            <button className="btn" onClick={()=>setExtraMenu('log')}>DETALHES DO ENVIO</button>
          </div>
          {extraMenu&&<div className="modal-overlay"><div className="variable-modal effect-modal"><h2>{extraMenu==='links'?'VÍNCULOS SALVOS':'DETALHES DO ENVIO'}</h2>{extraMenu==='links'?<>{Object.entries(carregarCatalogoBmp()).length===0&&<p>Nenhum vínculo salvo.</p>}{Object.entries(carregarCatalogoBmp()).map(([key,r])=><div key={key}><p>{key} → {r.nome}</p><button className="btn" disabled={enviando} onClick={()=>{mostrarBmpCatalogo(r.nome,r.base64,key);setExtraMenu('');setPainel('area')}}>ABRIR</button><button className="btn" disabled={enviando} onClick={()=>{if(window.confirm('Excluir vínculo?')){const c=carregarCatalogoBmp();delete c[key];salvarCatalogoBmp(c);setExtraMenu('');}}}>EXCLUIR</button></div>)}</>:<div className="result-box" style={{whiteSpace:'pre-wrap'}}>{status} · {progresso}%<p>{retorno}</p></div>}<button className="btn btn-full" onClick={()=>setExtraMenu('')}>VOLTAR</button></div></div>}
        </section>)}
        {painel!=='mais' && <div className="result-box" role="status">{retorno}</div>}
      </main>

      {qr && <div className="modal-overlay">
        <section className="variable-modal" role="dialog" aria-modal="true" aria-label="Leitura universal" style={{padding:16,maxHeight:'80dvh',overflowY:'auto',gap:8}}>
          {qr.etapa === 'original' && <>
            <h2>LEITURA UNIVERSAL</h2><p>Conteúdo original</p>
            <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:'32dvh',overflowY:'auto'}}>{qr.original}</pre>
            <p>Deseja organizar para impressão?</p>
            <button className="btn" onClick={()=>setQr(null)}>MANTER ORIGINAL</button>
            <button className="btn" onClick={()=>setQr({...qr,etapa:'linhas'})}>ORGANIZAR</button>
          </>}
          {qr.etapa === 'linhas' && <>
            <h2>ORGANIZAR PARA IMPRESSÃO</h2>
            {[1,2,3].map(n=><button className="btn" key={n} onClick={()=>revisarQr(n)}>{n} {n===1?'linha':'linhas'}</button>)}
            <button className="btn" onClick={()=>setQr(null)}>CANCELAR</button>
          </>}
          {qr.etapa === 'revisar' && <>
            <h2>REVISAR TEXTO · {qr.linhas} {qr.linhas===1?'LINHA':'LINHAS'}</h2>
            <textarea aria-label="Texto para impressão" rows={4} wrap="off" value={qr.texto} onChange={e=>setQr({...qr,texto:e.target.value})}/>
            <button className="btn" onClick={()=>setQr(null)}>MANTER ORIGINAL</button>
            <button className="btn" onClick={() => {
              setTexto(qr.texto)
              setModo('text')
              setPainel('texto')
              setQr(null)
            }}>USAR NO EDITOR</button>
          </>}
        </section>
      </div>}
      {efeito && <div className="modal-overlay"><div className="variable-modal effect-modal"><h2>EFEITOS DE TEXTO</h2><textarea value={texto} onChange={e=>setTexto(e.target.value)}/><select aria-label="Efeito de texto" style={{ boxSizing: 'border-box', width: '100%', height: 44, minHeight: 44, flexShrink: 0, padding: '0 8px', fontSize: 16, lineHeight: 'normal' }} value={efeito} onChange={e=>setEfeito(e.target.value)}><option value="negativo">Negativo</option><option value="vazado">Vazado</option><option value="normal">Normal — texto preto</option></select><select aria-label="Fonte do texto" style={{ boxSizing: 'border-box', width: '100%', height: 44, minHeight: 44, flexShrink: 0, padding: '0 8px', fontSize: 16, lineHeight: 'normal' }} value={fonteEfeito} onChange={e=>setFonteEfeito(e.target.value)}>{[['Arial','Sem serifa (estilo Arial)'],['Arial Black','Grossa'],['Georgia','Clássica serifada'],['Courier New','Máquina de escrever'],['Arial Narrow','Condensada'],['cursive','Manuscrita'],['sans-serif','Casual'],...fonts.map(f=>[f.name,f.label])].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select><label className="btn btn-full">IMPORTAR FONTE TTF / OTF<input type="file" accept=".ttf,.otf" style={{display:'none'}} onChange={importFont}/></label><label><input type="checkbox" checked={boldE} onChange={e=>setBoldE(e.target.checked)}/> Negrito</label><label><input type="checkbox" checked={italicE} onChange={e=>setItalicE(e.target.checked)}/> Itálico</label>{[['Tamanho da letra',sizeE,setSizeE,8,160],['Espessura do contorno',strokeE,setStrokeE,1,10],['Margem',marginE,setMarginE,0,24]].map(([n,v,f,min,max])=><label key={n}>{n}: {v} px<input type="range" min={min} max={max} value={v} onChange={e=>f(+e.target.value)}/></label>)}<div style={{display:'flex',justifyContent:'center',background:'#eee',padding:6}}>
        <canvas ref={effectCanvas} aria-label="Prévia do efeito de texto" hidden={!effectFits}
          style={{maxWidth:'100%',maxHeight:'32dvh',objectFit:'contain',imageRendering:'pixelated'}}/>
        {!effectFits && <span>{texto.trim() ? 'O texto excede o limite da imagem.' : 'Digite um texto para ver a prévia.'}</span>}
      </div><div className="edit-actions"><button className="btn" disabled={!effectFits || enviando} onClick={aplicarEfeito}>APLICAR</button><button className="btn" onClick={()=>setEfeito('')}>VOLTAR</button></div></div></div>}
      {editorAberto && (
        <div className="modal-overlay">
          <div className="variable-modal" ref={dialogoRef} key={etapaVariavel.tipo}
            role="dialog" aria-modal="true" aria-labelledby="variable-dialog-title"
            onKeyDown={event => {
              if (event.key === 'Escape') fecharEditor()
              if (event.key === 'Tab') {
                const controles = dialogoRef.current?.querySelectorAll('button, input')
                if (!controles?.length) return
                const primeiro = controles[0]
                const ultimo = controles[controles.length - 1]
                if (event.shiftKey && document.activeElement === primeiro) {
                  event.preventDefault()
                  ultimo.focus()
                } else if (!event.shiftKey && document.activeElement === ultimo) {
                  event.preventDefault()
                  primeiro.focus()
                }
              }
            }}>
            <h2 id="variable-dialog-title" className="variable-dialog-title">{dialogoVariavel.titulo}</h2>
            <div className="variable-dialog-content">
              {etapaVariavel.tipo === 'udi' ? (
                <input type="number" min="0" max="9999" inputMode="numeric"
                  aria-label="ID UDI (0 a 9999)" placeholder="ID UDI (0 a 9999)"
                  value={udiId} onChange={event => setUdiId(event.target.value)} />
              ) : (
                <div className="variable-options">
                  {dialogoVariavel.itens.map(item => (
                    <button type="button" key={item.rotulo} className="variable-option"
                      onClick={item.escolher}>{item.rotulo}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="variable-dialog-actions">
              <button type="button" onClick={fecharEditor}>CANCELAR</button>
              {etapaVariavel.tipo === 'udi' && (
                <>
                  <button type="button" onClick={() => adicionarToken('${udia' + clampUdi() + '}')}>GS1</button>
                  <button type="button" onClick={() => adicionarToken('${udi' + clampUdi() + '}')}>ADICIONAR</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

