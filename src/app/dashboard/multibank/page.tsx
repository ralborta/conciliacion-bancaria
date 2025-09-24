'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FileUploadZone from '@/components/conciliacion/FileUploadZone'
import ProcessingModal from '@/components/conciliacion/ProcessingModal'
import { UploadedFile, ProcessingStep } from '@/lib/types/conciliacion'

const BANCOS_ARGENTINA = [
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
  'Banco Hipotecario',
  'Otros'
]

interface BancoExtracto {
  id: string
  banco: string
  extracto: UploadedFile | null
}

export default function MultiBankPage() {
  const router = useRouter()
  
  // Archivos base
  const [ventasFile, setVentasFile] = useState<UploadedFile | null>(null)
  const [comprasFile, setComprasFile] = useState<UploadedFile | null>(null)
  const [periodo, setPeriodo] = useState('Septiembre 2024')
  
  // Lista de bancos/extractos
  const [bancosExtractos, setBancosExtractos] = useState<BancoExtracto[]>([
    { id: '1', banco: BANCOS_ARGENTINA[0], extracto: null }
  ])
  
  // Estado de procesamiento
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  
  // Agregar nuevo banco
  const agregarBanco = () => {
    if (bancosExtractos.length < 10) {
      setBancosExtractos([...bancosExtractos, {
        id: Date.now().toString(),
        banco: BANCOS_ARGENTINA[bancosExtractos.length % BANCOS_ARGENTINA.length],
        extracto: null
      }])
    }
  }
  
  // Eliminar banco
  const eliminarBanco = (id: string) => {
    setBancosExtractos(bancosExtractos.filter(b => b.id !== id))
  }
  
  // Actualizar banco
  const actualizarBanco = (id: string, campo: 'banco' | 'extracto', valor: any) => {
    setBancosExtractos(bancosExtractos.map(b => 
      b.id === id ? { ...b, [campo]: valor } : b
    ))
  }
  
  // Verificar si puede procesar
  const puedeProcesar = ventasFile && comprasFile && 
    bancosExtractos.length > 0 && 
    bancosExtractos.every(b => b.extracto !== null)
  
  // Procesar todos los bancos
  const procesarMultiBanco = async () => {
    if (!puedeProcesar || !ventasFile || !comprasFile) return
    
    setIsProcessing(true)
    setCurrentStep(0)
    setProgress(0)
    
    // Crear pasos de procesamiento
    const steps: ProcessingStep[] = [
      { id: 'step-1', name: 'Preparando archivos', status: 'pending', progress: 10 },
      ...bancosExtractos.map((b, i) => ({
        id: `bank-${i}`,
        name: `Procesando ${b.banco}`,
        status: 'pending' as const,
        progress: 10 + (80 / bancosExtractos.length) * (i + 1)
      })),
      { id: 'step-final', name: 'Generando reporte consolidado', status: 'pending', progress: 100 }
    ]
    
    setProcessingSteps(steps)
    
    try {
      // Preparar FormData con todos los archivos
      setStatus('Preparando archivos...')
      setProcessingSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i === 0 ? 'processing' : 'pending'
      })))
      
      const formData = new FormData()
      formData.append('ventas', ventasFile.file!)
      formData.append('compras', comprasFile.file!)
      formData.append('periodo', periodo)
      
      // Agregar todos los extractos
      bancosExtractos.forEach((banco, index) => {
        if (banco.extracto?.file) {
          formData.append(`extracto_${index}`, banco.extracto.file)
          formData.append(`banco_${index}`, banco.banco)
        }
      })
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Actualizar UI para mostrar progreso
      setProcessingSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i === 0 ? 'completed' : i === 1 ? 'processing' : 'pending'
      })))
      setCurrentStep(1)
      
      // Llamar a la nueva API multi-banco completa
      setStatus(`Procesando ${bancosExtractos.length} bancos...`)
      
      // Llamar a la API simple multibanco usando base relativa (mismo origen)
      const response = await fetch(`/api/conciliation/multibank-simple`, {
        method: 'POST',
        body: formData
      })
      
      // Simular progreso de bancos
      for (let i = 0; i < bancosExtractos.length; i++) {
        setCurrentStep(i + 1)
        setStatus(`Procesando ${bancosExtractos[i].banco}...`)
        setProgress(steps[i + 1].progress)
        setProcessingSteps(prev => prev.map((s, idx) => ({
          ...s,
          status: idx <= i ? 'completed' : idx === i + 1 ? 'processing' : 'pending'
        })))
        await new Promise(resolve => setTimeout(resolve, 800))
      }
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Error en el procesamiento')
      }
      
      // Generar reporte final
      setCurrentStep(steps.length - 1)
      setStatus('Generando reporte consolidado...')
      setProgress(100)
      setProcessingSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i < steps.length - 1 ? 'completed' : 'processing'
      })))
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setProcessingSteps(prev => prev.map(s => ({ ...s, status: 'completed' })))
      
      // Navegar a resultados
      router.push(`/dashboard/results?sessionId=${result.sessionId}&multibank=true`)
      
    } catch (error) {
      console.error('Error:', error)
      setStatus(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Conciliación Multi-Banco Completa
        </h1>
        <p className="text-gray-500 mb-8">
          Procesa múltiples bancos en una sola operación
        </p>
        
        {/* Archivos base */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">1. Archivos Base</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FileUploadZone
              type="ventas"
              onFileSelect={setVentasFile}
              onFileRemove={() => setVentasFile(null)}
              selectedFile={ventasFile}
              accept=".csv,.xlsx,.xls"
            />
            <FileUploadZone
              type="compras"
              onFileSelect={setComprasFile}
              onFileRemove={() => setComprasFile(null)}
              selectedFile={comprasFile}
              accept=".csv,.xlsx,.xls"
            />
          </div>
          
          <input
            type="text"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            placeholder="Período (ej: Septiembre 2024)"
            className="w-full p-2 border rounded-lg"
          />
        </div>
        
        {/* Lista de bancos */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">2. Extractos Bancarios</h2>
            <button
              onClick={agregarBanco}
              disabled={bancosExtractos.length >= 10}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              + Agregar Banco
            </button>
          </div>
          
          <div className="space-y-4">
            {bancosExtractos.map((banco, index) => (
              <div key={banco.id} className="flex gap-4 items-center p-4 border rounded-lg">
                <span className="text-sm font-medium w-8">{index + 1}.</span>
                
                <select
                  value={banco.banco}
                  onChange={(e) => actualizarBanco(banco.id, 'banco', e.target.value)}
                  className="flex-1 p-2 border rounded-lg"
                >
                  {BANCOS_ARGENTINA.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                
                <div className="flex-1">
                  <FileUploadZone
                    type="extracto"
                    onFileSelect={(file) => actualizarBanco(banco.id, 'extracto', file)}
                    onFileRemove={() => actualizarBanco(banco.id, 'extracto', null)}
                    selectedFile={banco.extracto}
                    accept=".csv,.xlsx,.xls,.pdf"
                  />
                </div>
                
                {bancosExtractos.length > 1 && (
                  <button
                    onClick={() => eliminarBanco(banco.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Botón procesar */}
        <div className="flex justify-end">
          <button
            onClick={procesarMultiBanco}
            disabled={!puedeProcesar || isProcessing}
            className={`px-8 py-3 rounded-lg font-medium ${
              puedeProcesar && !isProcessing
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing 
              ? `Procesando ${bancosExtractos.length} bancos...` 
              : `Procesar ${bancosExtractos.length} banco${bancosExtractos.length > 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
      
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
