// app/dashboard/next-bank/page.tsx - VERSIÓN CORREGIDA
// Usa el orquestrador mejorado sin reinicializar

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
  
  // Estado del banco anterior
  const [multiBankData, setMultiBankData] = useState<any>(null)
  const [previousBankInfo, setPreviousBankInfo] = useState<any>(null)
  
  // Orquestrador singleton (se mantiene entre navegaciones)
  const [orchestrator] = useState(() => {
    // Recuperar orquestrador existente o crear uno nuevo
    if (typeof window !== 'undefined') {
      const existing = (window as any).multiBankOrchestrator;
      if (existing) {
        console.log('♻️ Reutilizando orquestrador existente');
        return existing;
      }
    }
    
    const newOrchestrator = new MultiBankReconciliationOrchestrator();
    if (typeof window !== 'undefined') {
      (window as any).multiBankOrchestrator = newOrchestrator;
    }
    return newOrchestrator;
  })

  const bancoValido = banco !== 'Otro' || (banco === 'Otro' && bancoPersonalizado.trim() !== '')
  const puedeProcesar = extractoFile && bancoValido && periodo

  useEffect(() => {
    const loadPreviousData = async () => {
      console.log('📊 Cargando datos del banco anterior...');
      
      // Cargar datos del resultado anterior
      const storedData = localStorage.getItem('multiBankData')
      const storedSessionId = localStorage.getItem('multiBankSessionId')
      
      if (storedData) {
        const data = JSON.parse(storedData)
        setMultiBankData(data)
        
        // Extraer info del banco anterior
        if (data.bankSteps && data.bankSteps.length > 0) {
          const lastBank = data.bankSteps[data.bankSteps.length - 1];
          setPreviousBankInfo({
            banco: lastBank.banco || data.banco,
            conciliadas: lastBank.matchedCount || data.conciliados,
            pendientes: lastBank.pendingCount || data.pendientes,
            porcentaje: data.porcentajeConciliado
          });
        } else {
          // Datos del primer banco
          setPreviousBankInfo({
            banco: data.banco,
            conciliadas: data.conciliados,
            pendientes: data.pendientes,
            porcentaje: data.porcentajeConciliado
          });
        }

        // **CLAVE: Solo inicializar si NO está inicializado**
        if (!orchestrator.isInitialized()) {
          await initializeOrchestrator();
        } else {
          console.log('✅ Orquestrador ya inicializado, continuando...');
        }
        
      } else {
        console.error('❌ No hay datos del banco anterior, redirigiendo...')
        router.push('/dashboard')
      }
    }

    loadPreviousData()
  }, [orchestrator, router])

  /**
   * Inicializar el orquestrador SOLO la primera vez
   */
  const initializeOrchestrator = async () => {
    try {
      console.log('🚀 Inicializando orquestrador...');
      
      // Cargar archivos base desde localStorage
      const ventasFile = localStorage.getItem('ventasFile')
      const comprasFile = localStorage.getItem('comprasFile')
      
      if (!ventasFile || !comprasFile) {
        throw new Error('No se encontraron archivos base en localStorage');
      }

      // Convertir base64 a File
      const ventasBlob = new Blob([atob(ventasFile)], { type: 'text/csv' })
      const comprasBlob = new Blob([atob(comprasFile)], { type: 'text/csv' })
      
      const ventasFileObj = new File([ventasBlob], 'ventas.csv', { type: 'text/csv' })
      const comprasFileObj = new File([comprasBlob], 'compras.csv', { type: 'text/csv' })
      
      // Inicializar orquestrador (solo primera vez)
      await orchestrator.initialize(ventasFileObj, comprasFileObj)
      console.log('✅ Orquestrador inicializado correctamente')
      
    } catch (error) {
      console.error('❌ Error inicializando orquestrador:', error)
      throw error;
    }
  }

  const handleExtractoUpload = (file: UploadedFile) => {
    setExtractoFile(file)
  }

  const handleExtractoRemove = () => {
    setExtractoFile(null)
  }

  /**
   * MÉTODO PRINCIPAL: Procesar siguiente banco
   */
  const processNextBank = async () => {
    if (!puedeProcesar || !extractoFile) return

    setIsProcessing(true)
    setCurrentStep(0)
    setProgress(0)
    
    const steps: ProcessingStep[] = [
      { id: 'step-1', name: 'Preparando datos', status: 'pending', progress: 25 },
      { id: 'step-2', name: 'Procesando con banco siguiente', status: 'pending', progress: 50 },
      { id: 'step-3', name: 'Consolidando resultados', status: 'pending', progress: 75 },
      { id: 'step-4', name: 'Generando reporte', status: 'pending', progress: 100 }
    ]
    
    setProcessingSteps(steps)
    
    try {
      // PASO 1: Preparar datos
      setCurrentStep(0)
      setProgress(25)
      setStatus('Preparando datos pendientes del banco anterior...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index === 0 ? 'processing' : 'pending'
        }))
      )

      await new Promise(resolve => setTimeout(resolve, 1000))

      // PASO 2: Procesar con orquestrador mejorado
      setCurrentStep(1)
      setProgress(50)
      setStatus(`Procesando transacciones pendientes con ${banco}...`)
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 1 ? 'completed' : index === 1 ? 'processing' : 'pending'
        }))
      )

      const bancoFinal = banco === 'Otro' ? bancoPersonalizado : banco;
      
      console.log('🏦 Procesando banco:', bancoFinal);
      console.log('📄 Archivo extracto:', extractoFile.file?.name);

      // **USAR MÉTODO CORRECTO DEL ORQUESTRADOR**
      const result = await orchestrator.continueWithBank(
        extractoFile.file!,
        bancoFinal,
        periodo
      );

      console.log('✅ Resultado del banco siguiente:', result);

      // PASO 3: Consolidar
      setCurrentStep(2)
      setProgress(75)
      setStatus('Consolidando resultados multi-banco...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 2 ? 'completed' : index === 2 ? 'processing' : 'pending'
        }))
      )

      await new Promise(resolve => setTimeout(resolve, 500))

      // PASO 4: Finalizar
      setCurrentStep(3)
      setProgress(100)
      setStatus('Generando reporte consolidado...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 3 ? 'completed' : index === 3 ? 'processing' : 'pending'
        }))
      )

      // Guardar nuevos resultados
      if (result.success && result.data) {
        console.log('💾 Guardando resultados actualizados...');
        localStorage.setItem('conciliationData', JSON.stringify(result.data));
        localStorage.setItem('multiBankData', JSON.stringify(result.data));
        
        // Generar nuevo sessionId para estos resultados
        const newSessionId = `multibank_${Date.now()}`;
        localStorage.setItem('currentSessionId', newSessionId);
        localStorage.setItem('multiBankSessionId', newSessionId);
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

      // Navegar a resultados
      const sessionId = localStorage.getItem('currentSessionId');
      console.log('🎯 Navegando a resultados con sessionId:', sessionId);
      router.push(`/dashboard/results?sessionId=${sessionId}`)
      
    } catch (error) {
      console.error('❌ Error procesando siguiente banco:', error);
      const errorObj = error as Error;
      setStatus(`Error: ${errorObj.message}`)
      
      // En caso de error, mostrar mensaje útil
      if (errorObj.message.includes('no inicializado')) {
        setStatus('Error: Reinicia el proceso desde el dashboard principal');
      }
      
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Información del banco anterior */}
      {previousBankInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">
            📊 Resultado del Banco Anterior
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-blue-600">Banco Procesado</div>
              <div className="font-medium text-blue-800">{previousBankInfo.banco}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600">Conciliadas</div>
              <div className="text-2xl font-bold text-green-600">{previousBankInfo.conciliadas}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600">Pendientes</div>
              <div className="text-2xl font-bold text-orange-600">{previousBankInfo.pendientes}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600">% Conciliado</div>
              <div className="text-2xl font-bold text-blue-600">{previousBankInfo.porcentaje?.toFixed(1)}%</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Proceso Multi-Banco:</strong> Se procesarán las {previousBankInfo.pendientes} transacciones 
              pendientes del banco anterior con el nuevo extracto bancario que subas.
            </p>
          </div>
        </div>
      )}

      {/* Sección de upload del nuevo banco */}
      <div className="bg-white rounded-xl p-8 shadow-sm">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            🏦 Agregar Siguiente Banco
          </h2>
          <p className="text-gray-500 text-sm">
            Sube el extracto del siguiente banco para conciliar las transacciones pendientes
          </p>
        </div>

        {/* Upload del extracto */}
        <div className="mb-8">
          <FileUploadZone
            type="extracto"
            onFileSelect={handleExtractoUpload}
            onFileRemove={handleExtractoRemove}
            selectedFile={extractoFile}
            accept=".csv,.xlsx,.xls,.pdf"
          />
        </div>

        {/* Configuración del banco */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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

          {banco === 'Otro' && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Nombre del banco:
              </label>
              <input
                type="text"
                value={bancoPersonalizado}
                onChange={(e) => setBancoPersonalizado(e.target.value)}
                placeholder="Ingrese el nombre del banco"
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}

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

        {/* Botones de acción */}
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