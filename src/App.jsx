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

function App() {
  const [status, setStatus] = useState('Desconectado')
  const [texto, setTexto] = useState('TESTE LUCENAART')
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

    const device = await BleClient.requestDevice({
      optionalServices: [RELE_SERVICE_UUID]
    })

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
        <img className="brand-logo" src="/logo-lucenaart.jpg" alt="Lucenaart do Brasil"
          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.hidden = false }} />
        <div className="brand-fallback" hidden>LUCENAART <small>DO BRASIL</small></div>
        <div className="product-title">CT120 MANAGER</div>
        <div className="brand-tagline">A SUA PRODUÇÃO NÃO PODE PARAR</div>
      </header>
      <main className="workspace">
        <section className="connection-section">
          <h2>CONEXÃO</h2>
          <div className={`connection-status ${conectado ? 'online' : ''}`} role="status">
            <span aria-hidden="true">●</span> {status}
          </div>
          <div className="connection-buttons">
            <button className="btn" onClick={conectarCT120} disabled={enviando}>PROCURAR DISPOSITIVO</button>
            <button className="btn" onClick={desconectarCT120} disabled={enviando}>DESCONECTAR</button>
          </div>
        </section>
        <section className="print-section">
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
        </section>
        <section className="content-section">
          <h2>ENVIO AO CT120</h2>
          <label htmlFor="tipo-envio">Tipo de envio</label>
          <select id="tipo-envio" value={modo} onChange={e => setModo(e.target.value)} disabled={enviando}>
            <option value="text">Texto</option>
            <option value="variable">Variável</option>
            <option value="image">Imagem</option>
          </select>
          {modo !== 'image' && (
            <div className="input-panel">
              <label htmlFor="conteudo">Conteúdo</label>
              <textarea id="conteudo" value={texto} onChange={e => setTexto(e.target.value)}
                disabled={enviando} rows={5} placeholder="Digite o conteúdo para o CT120" />
            </div>
          )}
          {modo === 'variable' && (
            <button className="btn btn-full" disabled={enviando} ref={editorBotaoRef} onClick={() => { setEtapaVariavel({ tipo: 'menu' }); setEditorAberto(true) }}>EDITOR DE VARIÁVEIS</button>
          )}
          {modo === 'image' && (
            <div className="image-panel">
              <button type="button" className="btn btn-full" disabled={enviando}
                onClick={() => bmpCatalogoRef.current?.click()}>
                SELECIONAR IMAGEM BMP
              </button>
              <input ref={bmpCatalogoRef} type="file" accept=".bmp,image/bmp,image/x-ms-bmp"
                disabled={enviando} onChange={selecionarBmpCatalogo} style={{ display: 'none' }} />
              <div style={{ marginTop: '16px' }}>
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
              </div>
              {preview && <img className="image-preview" src={preview} alt="Prévia da imagem" />}
              {imagemNome && <div className="image-name">{imagemNome}</div>}
            </div>
          )}
          <button className="btn btn-full clear-button" disabled={enviando} onClick={limparConteudo}>LIMPAR TUDO</button>
        </section>
        <section className="jobs-section">
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
        </section>
        <section className="send-section">
          <div className="send-buttons">
            <button className="btn" disabled={enviando} onClick={enviar}>{enviando ? 'ENVIANDO...' : 'ENVIAR'}</button>
            <button className="btn" disabled={!enviando} onClick={pararEnvio} title="Interromper o envio ao CT120">PARAR</button>
          </div>
          <label className="progress-label" htmlFor="progresso">PROGRESSO DO ENVIO</label>
          <progress id="progresso" max="100" value={progresso} aria-label="Progresso do envio" />
        </section>
        <section className="log-section">
          <h2>LOG</h2>
          <div className="result-box" role="status" aria-live="polite">
            {retorno || `Pronto.\nTrabalhos encontrados: ${trabalhos.length}`}
          </div>
        </section>
      </main>

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

