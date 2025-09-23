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
    // Cargar datos del banco anterior
    const storedData = localStorage.getItem('multiBankData')
    const storedSessionId = localStorage.getItem('multiBankSessionId')
    
    if (storedData) {
      const data = JSON.parse(storedData)
      setMultiBankData(data)
      
      // Inicializar el orquestador con los archivos base
      // (Estos deberían estar guardados en localStorage también)
      const ventasFile = localStorage.getItem('ventasFile')
      const comprasFile = localStorage.getItem('comprasFile')
      
      if (ventasFile && comprasFile) {
        // Convertir de base64 a File
        const ventasBlob = new Blob([atob(ventasFile)], { type: 'application/octet-stream' })
        const comprasBlob = new Blob([atob(comprasFile)], { type: 'application/octet-stream' })
        
        const ventasFileObj = new File([ventasBlob], 'ventas.csv', { type: 'text/csv' })
        const comprasFileObj = new File([comprasBlob], 'compras.csv', { type: 'text/csv' })
        
        orchestrator.initialize(ventasFileObj, comprasFileObj)
      }
      
      // Contar bancos procesados
      const bankStats = orchestrator.getBankStats()
      setBankCount(bankStats.length + 1)
    } else {
      // Si no hay datos, redirigir al dashboard
      router.push('/dashboard')
    }
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
      // Simular procesamiento paso a paso
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(i)
        setProgress(steps[i].progress)
        setStatus(steps[i].name)
        setProcessingSteps(prev => 
          prev.map((step, index) => ({
            ...step,
            status: index < i ? 'completed' : index === i ? 'processing' : 'pending'
          }))
        )
        
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      // Procesar con el orquestador multi-banco
      const bancoNombre = banco === 'Otro' ? bancoPersonalizado : banco
      const results = await orchestrator.processBank(
        extractoFile.file,
        bancoNombre,
        {
          banco: bancoNombre,
          periodo: periodo
        }
      )

      // Generar resultado final consolidado
      const finalResult = orchestrator.generateFinalResult()
      
      // 🎯 GENERAR RESULTADOS CONSOLIDADOS CORRECTAMENTE
      const consolidatedData = {
        // Datos consolidados del orquestador
        movements: finalResult.allMatched, // Todas las transacciones conciliadas
        pendingMovements: finalResult.allPending, // Todas las pendientes
        totalMovimientos: finalResult.summary.totalMovimientos,
        conciliados: finalResult.summary.totalConciliados,
        pendientes: finalResult.summary.totalPendientes,
        porcentajeConciliado: finalResult.summary.matchRate,
        
        // Información multi-banco
        bancoActual: bancoNombre,
        bancosProcesados: finalResult.summary.totalBanks,
        bankSteps: finalResult.steps, // Pasos de cada banco
        
        // Asientos contables consolidados
        asientosContables: finalResult.consolidatedAsientos,
        
        // Datos originales para compatibilidad
        ventas: multiBankData.ventas || [],
        compras: multiBankData.compras || [],
        
        // Metadatos
        isMultiBank: true,
        processedAt: new Date().toISOString(),
        sessionType: 'multi-bank'
      }
      
      console.log('🎯 Datos consolidados generados:', consolidatedData)
      console.log('📊 Total conciliados:', consolidatedData.conciliados)
      console.log('📊 Total pendientes:', consolidatedData.pendientes)
      console.log('📊 Bancos procesados:', consolidatedData.bancosProcesados)
      
      // Guardar en localStorage
      localStorage.setItem('conciliationData', JSON.stringify(consolidatedData))
      localStorage.setItem('currentSessionId', `multi-bank-${Date.now()}`)
      
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
