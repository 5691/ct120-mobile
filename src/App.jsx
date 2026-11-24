import EditorImagem from './EditorImagem.jsx'
import Codigos, {Icones} from './Codigos.jsx'
import Industrial from './Industrial.jsx'
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

const iconPaths = {"save": "M4 3h14l3 3v15H3V3h1 M7 3v7h10V3 M7 21v-8h10v8", "folder": "M3 6h7l2 3h9v11H3z", "send": "M3 10l18-7-7 18-4-8z M10 13L21 3", "trash": "M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7", "texto": "M5 5h14 M12 5v14 M8 19h8 M5 5v3 M19 5v3", "variaveis": "M9 3H7l-1 7-3 2 3 2 1 7h2 M15 3h2l1 7 3 2-3 2-1 7h-2", "codigos": "M3 4v16 M6 4v16 M10 4v16 M12 4v16 M16 4v16 M21 4v16", "imagens": "M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M7 7h2v2H7z", "grid": "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z", "novo": "M5 3h10l4 4v7 M5 3v18h8 M15 3v5h4 M8 12h7 M18 15v8 M14 19h8", "bluetooth": "M12 2v20l7-6-14-9 M12 2l7 6-14 9"}
function Icon({name}) { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name] || iconPaths.grid}/></svg> }

function App() {
  useEffect(() => { document.title = "CT DESTROYER — BY LUCENAART" }, [])
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
    validarBmpBase64(base64)
    setModo('image')
    setImagemNome(nome)
    setImagemBase64(base64)
    setPreview(`data:image/bmp;base64,${base64}`)
    setCodigoDaPrevia(codigo)
    setProgresso(0)
  }

  function limparBmpDaPrevia() {
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

  function vincularCodigoBmp() {
    if (enviando) {
      setRetorno('Pare o envio antes de trocar a imagem.')
      return
    }
    const chave = codigoBmp.trim()
    if (!chave) {
      setRetorno('Leia ou digite o código primeiro.')
      return
    }
    if (!imagemBase64) {
      setRetorno('Selecione uma imagem BMP primeiro.')
      return
    }

    try {
      validarBmpBase64(imagemBase64)
      const catalogo = carregarCatalogoBmp()
      const substituindo = Boolean(catalogo[chave]) || chave === CODIGO_TESTE
      const mensagem = `${chave} → ${imagemNome || 'imagem.bmp'}\n\nConfira o código e a imagem antes de salvar.`
      if (!window.confirm(`${substituindo ? 'Substituir vínculo?' : 'Vincular BMP'}\n\n${mensagem}`)) return

      catalogo[chave] = { nome: imagemNome || 'imagem.bmp', base64: imagemBase64 }
      salvarCatalogoBmp(catalogo)
      setCodigoDaPrevia(chave)
      setResultadoCodigoBmp(`Vínculo salvo: ${chave} → ${imagemNome || 'imagem.bmp'}`)
      setRetorno('✓ Vínculo salvo no iPhone.')
    } catch (error) {
      setRetorno(`ERRO: ${error?.message || String(error)}`)
    }
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
    setCodigoDaPrevia('')
    setTexto('')
    setImagemNome('')
    setImagemBase64('')
    setPreview('')
    setRetorno('')
    setProgresso(0)
  }

  function bitmapIndustrial(c,nome) {
    const w=c.width,h=c.height,stride=Math.ceil(w/32)*4;
    const b=new Uint8Array(62+stride*h),v=new DataView(b.buffer),d=c.getContext('2d').getImageData(0,0,w,h).data;
    b[0]=66;b[1]=77;v.setUint32(2,b.length,true);v.setUint32(10,62,true);v.setUint32(14,40,true);v.setInt32(18,w,true);v.setInt32(22,h,true);v.setUint16(26,1,true);v.setUint16(28,1,true);v.setUint32(34,stride*h,true);v.setUint32(46,2,true);b.set([255,255,255,0],58);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4]>127)b[62+(h-1-y)*stride+(x>>3)]|=128>>(x%8);
    let raw='';for(const byte of b)raw+=String.fromCharCode(byte);
    mostrarBmpCatalogo(nome,btoa(raw));setPreview(c.toDataURL());setPainel('area');
  }
  function aplicarEfeito() {
    if (!texto.trim()) {setRetorno('Digite o conteúdo primeiro.');setEfeito('');return}
    const c=document.createElement('canvas');c.width=480;c.height=240;const x=c.getContext('2d');
    const linhas=texto.split('\n');let size=Math.min(sizeE,Math.floor((240-2*marginE)/linhas.length));
    do {x.font=`${italicE?"italic ":""}${boldE?"bold ":""}${size}px ${fonteEfeito}`;if(linhas.every(l=>x.measureText(l).width<=480-2*marginE))break;size--}while(size>8);
    x.fillStyle=efeito==='negativo'?'black':'white';x.fillRect(0,0,480,240);x.fillStyle=efeito==='negativo'?'white':'black';x.strokeStyle=x.fillStyle;x.lineWidth=strokeE;x.textBaseline='top';
    linhas.forEach((l,i)=>{if(efeito==='vazado')x.strokeText(l,marginE,marginE+i*size);else x.fillText(l,marginE,marginE+i*size)});
    const data=x.getImageData(0,0,480,240).data;const stride=60;const b=new Uint8Array(62+stride*240);const v=new DataView(b.buffer);b[0]=66;b[1]=77;v.setUint32(2,b.length,true);v.setUint32(10,62,true);v.setUint32(14,40,true);v.setInt32(18,480,true);v.setInt32(22,240,true);v.setUint16(26,1,true);v.setUint16(28,1,true);v.setUint32(34,stride*240,true);v.setUint32(46,2,true);b.set([255,255,255,0],58);
    for(let y=0;y<240;y++)for(let a=0;a<480;a++)if(data[(y*480+a)*4]>127)b[62+(239-y)*stride+(a>>3)]|=128>>(a%8);
    mostrarBmpCatalogo('texto-efeito.bmp',btoa(Array.from(b,n=>String.fromCharCode(n)).join('')));setPreview(c.toDataURL());setEfeito('');setPainel('area');
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <img className="brand-logo" src="/logo-lucenaart.jpg" alt="Lucenaart do Brasil"
          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.hidden = false }} />
        <div className="brand-fallback" hidden>LUCENAART <small>DO BRASIL</small></div>
        <div className="product-title">CT DESTROYER — BY LUCENAART</div>
        <div className="brand-tagline">A SUA PRODUÇÃO NÃO PODE PARAR</div>
      </header>
      <main className="workspace">
        <div className={`connection-status ${conectado ? 'online' : ''}`}>● {status}</div>
        <section className="work-area">
          <h2>ÁREA DE TRABALHO</h2>
          <div className="work-preview">{modo === 'image' ? (preview ? <img src={preview} alt="Prévia" /> : 'Selecione uma imagem') : (texto || 'Novo trabalho • Digite um texto ou gere um código')}</div>
        </section>
        {['texto','variaveis','imagens','codigos','icones'].includes(painel) && (        <section className="content-section">
          <h2>{painel.toUpperCase()}</h2>
          {['texto','variaveis'].includes(painel) && (
            <div className="input-panel">
              <label htmlFor="conteudo">Conteúdo</label>
              <textarea id="conteudo" value={texto} onChange={e => setTexto(e.target.value)}
                disabled={enviando} rows={5} placeholder="Digite o conteúdo para o CT120" />
              {painel==='texto' && <button className="btn btn-full" disabled={enviando} onClick={()=>setEfeito('normal')}>EFEITOS DE TEXTO</button>}
              <div className="edit-actions"><button className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(texto)}catch{setRetorno('Não foi possível copiar.')}}}>Copiar</button><button className="btn" disabled={enviando} onClick={async()=>{try{setTexto(await navigator.clipboard.readText())}catch{setRetorno('Use a opção Colar do teclado.')}}}>Colar</button><button className="btn" disabled={enviando} onClick={()=>setTexto('')}>Remover</button><button className="btn" onClick={()=>setPainel('area')}>Voltar</button></div>
            </div>
          )}
          {painel === 'variaveis' && (
            <button className="btn btn-full" disabled={enviando} ref={editorBotaoRef} onClick={() => { setEtapaVariavel({ tipo: 'menu' }); setEditorAberto(true) }}>EDITOR DE VARIÁVEIS</button>
          )}
          {painel==='codigos' && <Codigos onBitmap={bitmapIndustrial} disabled={enviando} onBack={()=>setPainel('area')} onRead={async()=>{try{const r=await CapacitorBarcodeScanner.scanBarcode({hint:CapacitorBarcodeScannerTypeHint.ALL,scanInstructions:'Aponte a câmera para o código'});return r?.ScanResult||''}catch(e){setRetorno(String(e.message||e));return ''}}}/> }
          {painel==='icones' && <Icones onSymbol={v=>{setTexto(t=>t+v);setModo('text');setPainel('texto')}} onBitmap={bitmapIndustrial} disabled={enviando} onBack={()=>setPainel('area')}/>}
          {painel==='imagens' && <EditorImagem onBitmap={bitmapIndustrial} disabled={enviando}/>}
          {['imagens','codigos'].includes(painel) && (
            <div className="image-panel">
              <button type="button" className="btn btn-full" disabled={enviando}
                onClick={() => bmpCatalogoRef.current?.click()}>
                SELECIONAR IMAGEM BMP
              </button>
              <input ref={bmpCatalogoRef} type="file" accept=".bmp,image/bmp,image/x-ms-bmp"
                disabled={enviando} onChange={selecionarBmpCatalogo} style={{ display: 'none' }} />
              {painel==='codigos' && <div style={{ marginTop: '16px' }}> 
                <strong style={{ color: '#2467b4' }}>CÓDIGO DE BARRAS / QR CODE → BMP</strong>
                <input
                  type="text"
                  value={codigoBmp}
                  onChange={e => alterarCodigoBmp(e.target.value)}
                  disabled={enviando}
                  placeholder="Leia ou digite o código"
                  style={{ width: '100%', marginTop: '10px', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px', marginTop: '10px' }}>
                  <button className="btn" style={{ minWidth: 0, width: '100%', paddingLeft: '6px', paddingRight: '6px' }} disabled={enviando || lendoCodigo} onClick={lerCodigoBmp}>
                    {lendoCodigo ? 'LENDO...' : 'LER CÓDIGO'}
                  </button>
                  <button className="btn" style={{ minWidth: 0, width: '100%', paddingLeft: '6px', paddingRight: '6px' }} disabled={enviando} onClick={() => buscarCodigoBmp()}>LOCALIZAR BMP</button>
                </div>
                <button className="btn btn-full" style={{ marginTop: '10px', width: '100%' }} disabled={enviando} onClick={vincularCodigoBmp}>
                  VINCULAR BMP AO CÓDIGO
                </button>
                <div style={{ marginTop: '12px', whiteSpace: 'pre-wrap' }}>{resultadoCodigoBmp}</div>
              </div>}
              {preview && <img className="image-preview" src={preview} alt="Prévia da imagem" />}
              {imagemNome && <div className="image-name">{imagemNome}</div>}
            </div>
          )}

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
        <nav className="nav-grid">{[['texto','texto','TEXTO'],['variaveis','variaveis','VARIÁVEIS'],['codigos','codigos','CÓDIGOS'],['imagens','imagens','IMAGENS'],['icones','grid','ÍCONES'],['area','grid','ÁREA'],['trabalhos','folder','TRABALHOS'],['novo','novo','NOVO'],['mais','grid','MAIS'],['bluetooth','bluetooth','BLUETOOTH']].map(([id,icone,nome]) => <button key={id} className={'btn '+(painel===id?'selected':'')} disabled={enviando} onClick={()=>{if(id==='novo'){novoTrabalho();setPainel('texto');return}setPainel(id);if(id==='texto')setModo('text');if(id==='variaveis')setModo('variable');if(id==='imagens')setModo('image')}}><Icon name={icone}/>{nome}</button>)}</nav>
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
          <Industrial onBitmap={bitmapIndustrial} disabled={enviando}/><div className="more-tools"><button className="btn" onClick={()=>setExtraMenu('links')}>VÍNCULOS SALVOS</button><button className="btn" disabled={releOcupado||enviando} onClick={imprimirPeloRele}>ACIONAR RELÉ</button><button className="btn" onClick={()=>setExtraMenu('log')}>DETALHES DO ENVIO</button></div>
          {extraMenu&&<div className="modal-overlay"><div className="variable-modal effect-modal"><h2>{extraMenu==='links'?'VÍNCULOS SALVOS':'DETALHES DO ENVIO'}</h2>{extraMenu==='links'?<>{Object.entries(carregarCatalogoBmp()).length===0&&<p>Nenhum vínculo salvo.</p>}{Object.entries(carregarCatalogoBmp()).map(([key,r])=><div key={key}><p>{key} → {r.nome}</p><button className="btn" disabled={enviando} onClick={()=>{mostrarBmpCatalogo(r.nome,r.base64,key);setExtraMenu('');setPainel('area')}}>ABRIR</button><button className="btn" disabled={enviando} onClick={()=>{if(window.confirm('Excluir vínculo?')){const c=carregarCatalogoBmp();delete c[key];salvarCatalogoBmp(c);setExtraMenu('');}}}>EXCLUIR</button></div>)}</>:<div className="result-box" style={{whiteSpace:'pre-wrap'}}>{status} · {progresso}%<p>{retorno}</p></div>}<button className="btn btn-full" onClick={()=>setExtraMenu('')}>VOLTAR</button></div></div>}
        </section>)}
        {painel!=='mais' && <div className="result-box" role="status">{retorno}</div>}
      </main>

      {efeito && <div className="modal-overlay"><div className="variable-modal effect-modal"><h2>EFEITOS DE TEXTO</h2><textarea value={texto} onChange={e=>setTexto(e.target.value)}/><select value={efeito} onChange={e=>setEfeito(e.target.value)}><option value="negativo">Negativo</option><option value="vazado">Vazado</option><option value="normal">Normal (imagem)</option></select><select value={fonteEfeito} onChange={e=>setFonteEfeito(e.target.value)}>{[['Arial','Sem serifa'],['Arial Black','Grossa'],['Georgia','Clássica serifada'],['Courier New','Máquina de escrever'],['Arial Narrow','Condensada'],['cursive','Manuscrita'],['sans-serif','Casual'],...fonts.map(f=>[f.name,f.label])].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select><label className="btn btn-full">IMPORTAR FONTE TTF / OTF<input type="file" accept=".ttf,.otf" style={{display:'none'}} onChange={importFont}/></label><label><input type="checkbox" checked={boldE} onChange={e=>setBoldE(e.target.checked)}/> Negrito</label><label><input type="checkbox" checked={italicE} onChange={e=>setItalicE(e.target.checked)}/> Itálico</label>{[['Tamanho da letra',sizeE,setSizeE,8,160],['Espessura do contorno',strokeE,setStrokeE,1,10],['Margem',marginE,setMarginE,0,24]].map(([n,v,f,min,max])=><label key={n}>{n}: {v} px<input type="range" min={min} max={max} value={v} onChange={e=>f(+e.target.value)}/></label>)}<div className="effect-preview" style={{fontFamily:fonteEfeito,fontWeight:boldE?"bold":"normal",fontStyle:italicE?"italic":"normal",fontSize:sizeE,padding:marginE,background:efeito==='negativo'?'black':'white',color:efeito==='negativo'?'white':efeito==='vazado'?'transparent':'black',WebkitTextStroke:efeito==='vazado'?`${strokeE}px black`:undefined}}>{texto}</div><div className="edit-actions"><button className="btn" onClick={aplicarEfeito}>APLICAR</button><button className="btn" onClick={()=>setEfeito('')}>VOLTAR</button></div></div></div>}
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

