'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FileUploadZone from '@/components/conciliacion/FileUploadZone'
import ProcessingModal from '@/components/conciliacion/ProcessingModal'
import { MultiBankReconciliationOrchestrator } from '@/lib/engine/multiBankOrchestrator'
import { UploadedFile, ProcessingStep } from '@/lib/types/conciliacion'
import { BANCOS } from '@/lib/types/conciliacion'

export default function NextBankPage() {
  const router = useRouter()
  
  // Estado de archivos y procesamiento
  const [extractoFile, setExtractoFile] = useState<UploadedFile | null>(null)
  const [banco, setBanco] = useState('Banco de la Nación Argentina')
  const [bancoPersonalizado, setBancoPersonalizado] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  
  // Estado del orquestador multi-banco
  const [orchestrator] = useState(() => new MultiBankReconciliationOrchestrator())
  const [multiBankData, setMultiBankData] = useState<any>(null)
  const [bankCount, setBankCount] = useState(1)
  
  // Estado para mostrar resultados consolidados
  const [showResults, setShowResults] = useState(false)
  const [consolidatedResults, setConsolidatedResults] = useState<any>(null)

  const bancoValido = banco !== 'Otro' || (banco === 'Otro' && bancoPersonalizado.trim() !== '')
  const puedeProcesar = extractoFile && bancoValido && periodo

  useEffect(() => {
    const initializeOrchestrator = async () => {
      // Cargar datos del banco anterior
      const storedData = localStorage.getItem('multiBankData')
      const storedSessionId = localStorage.getItem('multiBankSessionId')
      
      console.log('🔄 Inicializando orquestador con datos:', storedData ? 'SÍ' : 'NO')
      
      if (storedData) {
        const data = JSON.parse(storedData)
        setMultiBankData(data)
        
        // Inicializar el orquestador con los archivos base
        const ventasFile = localStorage.getItem('ventasFile')
        const comprasFile = localStorage.getItem('comprasFile')
        
        if (ventasFile && comprasFile) {
          try {
            // Convertir de base64 a File
            const ventasBlob = new Blob([atob(ventasFile)], { type: 'text/csv' })
            const comprasBlob = new Blob([atob(comprasFile)], { type: 'text/csv' })
            
            const ventasFileObj = new File([ventasBlob], 'ventas.csv', { type: 'text/csv' })
            const comprasFileObj = new File([comprasBlob], 'compras.csv', { type: 'text/csv' })
            
            // NO reiniciar el orquestador, solo inicializar si es la primera vez
            if (!orchestrator.isInitialized()) {
              await orchestrator.initialize(ventasFileObj, comprasFileObj)
              console.log('✅ Orquestador inicializado correctamente')
            } else {
              console.log('✅ Orquestador ya inicializado, continuando...')
            }
            
            // Cargar datos del banco anterior en el orquestador
            if (data.movements) {
              // Simular que ya procesamos el primer banco
              console.log('📊 Cargando datos del banco anterior:', data.movements.length, 'movimientos')
            }
          } catch (error) {
            console.error('❌ Error inicializando orquestador:', error)
          }
        } else {
          console.error('❌ No se encontraron archivos base en localStorage')
        }
        
        // Contar bancos procesados
        setBankCount(2) // Asumir que ya procesamos 1 banco
      } else {
        // Si no hay datos, redirigir al dashboard
        console.log('❌ No hay datos de banco anterior, redirigiendo al dashboard')
        router.push('/dashboard')
      }
    }

    initializeOrchestrator()
  }, [orchestrator, router])

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
      { id: 'step-1', name: 'Validando archivo del banco', status: 'pending', progress: 25 },
      { id: 'step-2', name: 'Procesando con transacciones pendientes', status: 'pending', progress: 50 },
      { id: 'step-3', name: 'Ejecutando conciliación', status: 'pending', progress: 75 },
      { id: 'step-4', name: 'Generando resultados consolidados', status: 'pending', progress: 100 }
    ]
    
    setProcessingSteps(steps)
    
    try {
      // PASO 1: Validar archivo del banco
      setCurrentStep(0)
      setProgress(25)
      setStatus('Validando archivo del banco...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index === 0 ? 'processing' : 'pending'
        }))
      )
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // PASO 2: Procesar con transacciones pendientes
      setCurrentStep(1)
      setProgress(50)
      setStatus('Procesando con transacciones pendientes...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 1 ? 'completed' : index === 1 ? 'processing' : 'pending'
        }))
      )
      
      // Procesar con la API directamente (como el primer banco)
      const bancoNombre = banco === 'Otro' ? bancoPersonalizado : banco
      console.log("🔄 Procesando banco adicional con API:", bancoNombre)
      
      // Crear FormData para la API
      const formData = new FormData()
      formData.append('ventas', multiBankData.ventasFile || '')
      formData.append('compras', multiBankData.comprasFile || '')
      formData.append('extracto', extractoFile.file)
      formData.append('banco', bancoNombre)
      formData.append('periodo', periodo)
      
      // Llamar a la API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://conciliacion-bancaria-production.up.railway.app'
      const response = await fetch(`${apiUrl}/api/conciliation/process`, {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`)
      }
      
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Error en el procesamiento')
      }
      
      console.log("✅ Banco adicional procesado con API:", result.data)
      
      // Simular resultados para compatibilidad
      const results = result.data.movements || []
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // PASO 3: Ejecutar conciliación
      setCurrentStep(2)
      setProgress(75)
      setStatus('Ejecutando conciliación...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 2 ? 'completed' : index === 2 ? 'processing' : 'pending'
        }))
      )
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // PASO 4: Generar resultados consolidados
      setCurrentStep(3)
      setProgress(100)
      setStatus('Generando resultados consolidados...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 3 ? 'completed' : index === 3 ? 'processing' : 'pending'
        }))
      )
      
      // Usar datos de la API directamente
      const uiData = {
        totalMovimientos: result.data.totalMovimientos || 0,
        conciliados: result.data.conciliados || 0,
        pendientes: result.data.pendientes || 0,
        porcentajeConciliado: result.data.porcentajeConciliado || 0,
        montoTotal: result.data.montoTotal || 0,
        movements: result.data.movements || [],
        banco: bancoNombre,
        periodo: periodo,
        asientos: result.data.asientos || [],
        
        // Información multi-banco
        bancosProcesados: 2, // Asumir que ya procesamos 2 bancos
        bankSteps: [],
        bancoActual: bancoNombre,
        isMultiBank: true
      }
      
      console.log("💾 Guardando resultados consolidados:", uiData)
      
      // Guardar en localStorage para siguiente banco
      const sessionId = `multi-bank-${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('multiBankData', JSON.stringify(uiData))
      localStorage.setItem('multiBankSessionId', sessionId)
      localStorage.setItem('conciliationData', JSON.stringify(uiData))
      localStorage.setItem('currentSessionId', sessionId)
      
      // Mostrar resultados consolidados
      setConsolidatedResults(uiData)
      setShowResults(true)
      
      // Actualizar contador de bancos
      setBankCount(2)
      
      console.log(`✅ Banco ${bancoNombre} procesado con API:`)
      console.log(`   - Total conciliadas: ${uiData.conciliados}`)
      console.log(`   - Total pendientes: ${uiData.pendientes}`)
      console.log(`   - Porcentaje: ${uiData.porcentajeConciliado}%`)
      
      // Redirigir a resultados
      setTimeout(() => {
        router.push('/dashboard/results')
      }, 1000)
      
      // Datos ya guardados arriba
      
      setStatus('Conciliación multi-banco completada')
      
      // Redirigir a resultados
      setTimeout(() => {
        router.push('/dashboard/results')
      }, 1000)
      
    } catch (error) {
      console.error('Error en conciliación multi-banco:', error)
      setStatus('Error en la conciliación')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBackToResults = () => {
    router.push('/dashboard/results')
  }

  if (!multiBankData) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Cargando datos del banco anterior...
          </h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            🏦 Agregar Banco #{bankCount}
          </h2>
          <p className="text-gray-600">
            Procesa otro banco con las transacciones pendientes del anterior
          </p>
        </div>
        <button
          onClick={handleBackToResults}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
        >
          ← Volver a Resultados
        </button>
      </div>

      {/* Resumen del banco anterior */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          📊 Resumen del Banco Anterior
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{multiBankData.totalMovimientos || 0}</div>
            <div className="text-sm text-gray-500">Total Movimientos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{multiBankData.conciliados || 0}</div>
            <div className="text-sm text-gray-500">Conciliados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{multiBankData.pendientes || 0}</div>
            <div className="text-sm text-gray-500">Pendientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{multiBankData.porcentajeConciliado || 0}%</div>
            <div className="text-sm text-gray-500">% Conciliado</div>
          </div>
        </div>
        <div className="mt-3 text-sm text-gray-600">
          <strong>Transacciones pendientes:</strong> {multiBankData.pendientes || 0} movimientos serán procesados con el nuevo banco
        </div>
      </div>

      {/* Formulario de carga */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Cargar Extracto del Siguiente Banco
        </h3>
        
        <div className="space-y-6">
          {/* Carga de archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Extracto Bancario
            </label>
            <FileUploadZone
              type="extracto"
              onFileSelect={handleExtractoUpload}
              onFileRemove={handleExtractoRemove}
              selectedFile={extractoFile}
              accept=".csv,.xlsx,.xls"
            />
          </div>

          {/* Selección de banco */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Banco
              </label>
              <select 
                value={banco} 
                onChange={(e) => setBanco(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {BANCOS.map(banco => (
                  <option key={banco.id} value={banco.nombre}>
                    {banco.nombre}
                  </option>
                ))}
              </select>
              {banco === 'Otro' && (
                <input
                  type="text"
                  placeholder="Ingrese nombre del banco"
                  value={bancoPersonalizado}
                  onChange={(e) => setBancoPersonalizado(e.target.value)}
                  className="w-full mt-2 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Período (MM-AA)
              </label>
              <input
                type="text"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                placeholder="12-23"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Botón de procesamiento */}
          <div className="flex justify-end">
            <button
              onClick={processNextBank}
              disabled={!puedeProcesar || isProcessing}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isProcessing ? 'Procesando...' : `Procesar Banco #${bankCount}`}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados consolidados */}
      {showResults && consolidatedResults && (
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            📊 Resultados Consolidados
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {consolidatedResults.totalMovimientos}
              </div>
              <div className="text-sm text-blue-800">Total Movimientos</div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {consolidatedResults.conciliados}
              </div>
              <div className="text-sm text-green-800">Conciliados</div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {consolidatedResults.pendientes}
              </div>
              <div className="text-sm text-yellow-800">Pendientes</div>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {consolidatedResults.porcentajeConciliado.toFixed(1)}%
              </div>
              <div className="text-sm text-purple-800">Conciliación</div>
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">
              🏦 Bancos Procesados: {consolidatedResults.bancosProcesados}
            </h4>
            <p className="text-gray-600">
              Banco actual: <strong>{consolidatedResults.bancoActual}</strong>
            </p>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard/results')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ver Reporte Completo
            </button>
            
            <button
              onClick={() => {
                setShowResults(false)
                setConsolidatedResults(null)
                setExtractoFile(null)
                setPeriodo('')
              }}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Procesar Otro Banco
            </button>
          </div>
        </div>
      )}

      {/* Modal de procesamiento */}
      <ProcessingModal
        isOpen={isProcessing}
        onClose={() => setIsProcessing(false)}
        steps={processingSteps}
        currentStep={currentStep}
        progress={progress}
        status={status}
      />
    </div>
  )
}
