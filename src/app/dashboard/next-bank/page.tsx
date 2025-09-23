// app/dashboard/next-bank/page.tsx - FIX FUNCIONAL
// Usar API directamente, sin orquestrador problemático

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FileUploadZone from '@/components/conciliacion/FileUploadZone'
import ProcessingModal from '@/components/conciliacion/ProcessingModal'
import { UploadedFile, ProcessingStep } from '@/lib/types/conciliacion'

const BANCOS = [
  'Banco de la Nación Argentina',
  'Banco de la Provincia de Buenos Aires',
  'Banco de Galicia y Buenos Aires',
  'Banco Santander Argentina',
  'BBVA Argentina',
  'Banco Macro',
  'Banco Credicoop Cooperativo',
  'ICBC Argentina',
  'Banco de la Ciudad de Buenos Aires',
  'Banco Patagonia',
  'Banco Supervielle',
  'Banco de la Provincia de Córdoba (Bancor)',
  'Banco Hipotecario',
  'Banco Itaú Argentina',
  'Banco Comafi',
  'Banco Industrial (BIND)',
  'Banco de Valores',
  'Banco Provincia de Neuquén (BPN)',
  'Citibank N.A. (Sucursal Argentina)',
  'Otros'
]

export default function NextBankPage() {
  const router = useRouter()
  
  const [extractoFile, setExtractoFile] = useState<UploadedFile | null>(null)
  const [banco, setBanco] = useState('Banco de la Nación Argentina')
  const [periodo, setPeriodo] = useState('Septiembre 2024')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  
  const [multiBankData, setMultiBankData] = useState<any>(null)

  const puedeProcesar = extractoFile && banco && periodo

  useEffect(() => {
    // Cargar datos del banco anterior
    const storedData = localStorage.getItem('multiBankData')
    
    if (storedData) {
      const data = JSON.parse(storedData)
      setMultiBankData(data)
    } else {
      console.error('No hay datos del banco anterior')
      router.push('/dashboard')
    }
  }, [router])

  const handleExtractoUpload = (file: UploadedFile) => {
    setExtractoFile(file)
  }

  const handleExtractoRemove = () => {
    setExtractoFile(null)
  }

  const processNextBank = async () => {
    if (!puedeProcesar || !extractoFile) return

    setIsProcessing(true)
    setCurrentStep(0)
    setProgress(0)
    
    const steps: ProcessingStep[] = [
      { id: 'step-1', name: 'Cargando archivos base', status: 'pending', progress: 25 },
      { id: 'step-2', name: 'Enviando a procesar', status: 'pending', progress: 50 },
      { id: 'step-3', name: 'Ejecutando conciliación', status: 'pending', progress: 75 },
      { id: 'step-4', name: 'Generando reporte', status: 'pending', progress: 100 }
    ]
    
    setProcessingSteps(steps)
    
    try {
      // PASO 1: Cargar archivos base desde localStorage
      setCurrentStep(0)
      setProgress(25)
      setStatus('Cargando archivos base...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index === 0 ? 'processing' : 'pending'
        }))
      )

      // Obtener archivos base de localStorage
      const ventasFile = localStorage.getItem('ventasFile')
      const comprasFile = localStorage.getItem('comprasFile')
      
      if (!ventasFile || !comprasFile) {
        throw new Error('No se encontraron archivos base. Reinicia desde el dashboard.')
      }

      console.log('Archivos base encontrados en localStorage')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // PASO 2: Preparar FormData
      setCurrentStep(1)
      setProgress(50)
      setStatus('Preparando datos para enviar...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 1 ? 'completed' : index === 1 ? 'processing' : 'pending'
        }))
      )

      // Convertir base64 a Blob y luego a File
      const ventasBlob = new Blob([atob(ventasFile)], { type: 'text/csv' })
      const comprasBlob = new Blob([atob(comprasFile)], { type: 'text/csv' })
      
      const ventasFileObj = new File([ventasBlob], 'ventas.csv', { type: 'text/csv' })
      const comprasFileObj = new File([comprasBlob], 'compras.csv', { type: 'text/csv' })

      // Preparar FormData
      const formData = new FormData()
      formData.append('ventas', ventasFileObj)
      formData.append('compras', comprasFileObj)
      formData.append('extracto', extractoFile.file!)
      formData.append('banco', banco)
      formData.append('periodo', periodo)

      console.log('FormData preparada:', {
        ventas: ventasFileObj.name,
        compras: comprasFileObj.name,
        extracto: extractoFile.file?.name,
        banco,
        periodo
      })

      await new Promise(resolve => setTimeout(resolve, 1000))

      // PASO 3: Llamar a API
      setCurrentStep(2)
      setProgress(75)
      setStatus('Ejecutando conciliación...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 2 ? 'completed' : index === 2 ? 'processing' : 'pending'
        }))
      )

      console.log('Llamando a API...')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://conciliacion-bancaria-production.up.railway.app'
      const response = await fetch(`${apiUrl}/api/conciliation/process`, {
        method: 'POST',
        body: formData
      })

      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error HTTP:', errorText)
        throw new Error(`Error HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Resultado de API:', result)

      if (!result.success) {
        throw new Error(result.error || 'Error en el procesamiento')
      }

      // PASO 4: Guardar resultados
      setCurrentStep(3)
      setProgress(100)
      setStatus('Generando reporte...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 3 ? 'completed' : index === 3 ? 'processing' : 'pending'
        }))
      )

      // Marcar como multi-banco y agregar info del banco anterior
      if (result.data) {
        result.data.isMultiBank = true
        result.data.previousBank = multiBankData?.banco
        result.data.bankSteps = [
          ...(multiBankData?.bankSteps || []),
          {
            banco: banco,
            processedAt: new Date().toISOString(),
            matchedCount: result.data.conciliados || 0,
            pendingCount: result.data.pendientes || 0,
            ventasConciliadas: 0, // TODO: calcular
            totalVentas: 0, // TODO: calcular
            comprasConciliadas: 0, // TODO: calcular
            totalCompras: 0 // TODO: calcular
          }
        ]

        console.log('Guardando resultados:', result.data)
        localStorage.setItem('conciliationData', JSON.stringify(result.data))
        localStorage.setItem('multiBankData', JSON.stringify(result.data))
        localStorage.setItem('currentSessionId', result.sessionId)
        localStorage.setItem('multiBankSessionId', result.sessionId)
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

      // Navegar a resultados
      console.log('Navegando a resultados')
      router.push(`/dashboard/results?sessionId=${result.sessionId}`)
      
    } catch (error) {
      console.error('Error completo:', error)
      const errorObj = error as Error
      setStatus(`Error: ${errorObj.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Info del banco anterior */}
      {multiBankData && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">
            Resultado del Banco Anterior
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-blue-600">Banco</div>
              <div className="font-medium text-blue-800">{multiBankData.banco}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600">Conciliadas</div>
              <div className="text-2xl font-bold text-green-600">{multiBankData.conciliados}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600">Pendientes</div>
              <div className="text-2xl font-bold text-orange-600">{multiBankData.pendientes}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600">% Conciliado</div>
              <div className="text-2xl font-bold text-blue-600">{multiBankData.porcentajeConciliado}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Upload section */}
      <div className="bg-white rounded-xl p-8 shadow-sm">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Agregar Siguiente Banco
          </h2>
          <p className="text-gray-500 text-sm">
            Sube el extracto del siguiente banco para continuar la conciliación
          </p>
        </div>

        <div className="mb-8">
          <FileUploadZone
            type="extracto"
            onFileSelect={handleExtractoUpload}
            onFileRemove={handleExtractoRemove}
            selectedFile={extractoFile}
            accept=".csv,.xlsx,.xls,.pdf"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Banco:
            </label>
            <select 
              value={banco} 
              onChange={(e) => setBanco(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              {BANCOS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Período:
            </label>
            <input
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="ej: Septiembre 2024"
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => router.push('/dashboard/results')}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Volver a Resultados
          </button>

          <button
            onClick={processNextBank}
            disabled={!puedeProcesar || isProcessing}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              puedeProcesar && !isProcessing
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? 'Procesando...' : 'Procesar Siguiente Banco'}
          </button>
        </div>
      </div>

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={isProcessing}
        onClose={() => {}}
        steps={processingSteps}
        currentStep={currentStep}
        progress={progress}
        status={status}
      />
    </div>
  )
}