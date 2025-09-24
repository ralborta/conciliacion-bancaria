'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import FileUploadZone from '@/components/conciliacion/FileUploadZone'
import ProcessingModal from '@/components/conciliacion/ProcessingModal'
import { UploadedFile, ProcessingStep } from '@/lib/types/conciliacion'
import { RotateCcw, Zap } from 'lucide-react'

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

const PERIODOS = [
  'Septiembre 2024',
  'Agosto 2024',
  'Julio 2024'
]

// Función para convertir archivo a base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const base64 = reader.result as string
      // Remover el prefijo "data:application/octet-stream;base64,"
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = error => reject(error)
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [files, setFiles] = useState<{
    ventas: UploadedFile | null
    compras: UploadedFile | null
    extracto: UploadedFile | null
  }>({
    ventas: null,
    compras: null,
    extracto: null
  })
  
  const [banco, setBanco] = useState('Banco Provincia')
  const [periodo, setPeriodo] = useState('Septiembre 2024')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')

  const allFilesUploaded = files.ventas && files.compras && files.extracto

  const handleFileSelect = (type: 'ventas' | 'compras' | 'extracto') => (file: UploadedFile) => {
    setFiles(prev => ({ ...prev, [type]: file }))
  }

  const handleFileRemove = (type: 'ventas' | 'compras' | 'extracto') => () => {
    setFiles(prev => ({ ...prev, [type]: null }))
  }

  const resetFiles = () => {
    setFiles({ ventas: null, compras: null, extracto: null })
  }

  const processConciliation = async () => {
    if (!allFilesUploaded) return

    setIsProcessing(true)
    setCurrentStep(0)
    setProgress(0)
    
    const steps: ProcessingStep[] = [
      { id: 'step-1', name: 'Validando archivos', status: 'pending', progress: 25 },
      { id: 'step-2', name: 'Enviando a procesar', status: 'pending', progress: 50 },
      { id: 'step-3', name: 'Ejecutando conciliación', status: 'pending', progress: 75 },
      { id: 'step-4', name: 'Generando reporte', status: 'pending', progress: 100 }
    ]
    
    setProcessingSteps(steps)
    
    try {
      // PASO 1: Validar archivos
      setCurrentStep(0)
      setProgress(25)
      setStatus('Validando archivos...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index === 0 ? 'processing' : 'pending'
        }))
      )
      
      // Verificar que los archivos existen
      if (!files.ventas?.file || !files.compras?.file || !files.extracto?.file) {
        throw new Error('Faltan archivos requeridos')
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // PASO 2: Preparar datos
      setCurrentStep(1)
      setProgress(50)
      setStatus('Enviando a procesar...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 1 ? 'completed' : index === 1 ? 'processing' : 'pending'
        }))
      )
      
      // Prepare form data
      const formData = new FormData()
      formData.append('ventas', files.ventas!.file)
      formData.append('compras', files.compras!.file)
      formData.append('extracto', files.extracto!.file)
      formData.append('banco', banco)
      formData.append('periodo', periodo)
      
      // PASO 3: Llamar API y ESPERAR respuesta
      setCurrentStep(2)
      setProgress(75)
      setStatus('Ejecutando conciliación...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 2 ? 'completed' : index === 2 ? 'processing' : 'pending'
        }))
      )
      
      console.log("🚀 Frontend - Iniciando conciliación");
      console.log("📊 Datos a enviar:", {
        ventas: files.ventas?.file?.name,
        compras: files.compras?.file?.name,
        extracto: files.extracto?.file?.name,
        banco,
        periodo
      });
      
      // Call API y ESPERAR la respuesta
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://conciliacion-bancaria-production.up.railway.app';
      console.log("🌐 Llamando a API:", `${apiUrl}/api/conciliation/process`);
      const response = await fetch(`${apiUrl}/api/conciliation/process`, {
        method: 'POST',
        body: formData
      })
      
      console.log("🌐 Response status:", response.status);
      console.log("🌐 Response ok:", response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error HTTP:", errorText);
        throw new Error(`Error HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log("✅ Resultado completo:", result);
      
      if (!result.success) {
        throw new Error(result.error || 'Error en el procesamiento');
      }
      
      // ✅ GUARDAR DATOS EN LOCALSTORAGE ANTES DE NAVEGAR
      if (result.data) {
        console.log("💾 Guardando datos en localStorage:", result.data);
        localStorage.setItem('conciliationData', JSON.stringify(result.data));
        localStorage.setItem('currentSessionId', result.sessionId);
        
        // 💾 GUARDAR ARCHIVOS BASE PARA MULTI-BANCO
        console.log("💾 Guardando archivos base para multi-banco");
        if (files.ventas?.file) {
          const ventasBase64 = await fileToBase64(files.ventas.file);
          localStorage.setItem('ventasFile', ventasBase64);
        }
        if (files.compras?.file) {
          const comprasBase64 = await fileToBase64(files.compras.file);
          localStorage.setItem('comprasFile', comprasBase64);
        }
      }
      
      // PASO 4: Completar
      setCurrentStep(3)
      setProgress(100)
      setStatus('Generando reporte...')
      setProcessingSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index < 3 ? 'completed' : index === 3 ? 'processing' : 'pending'
        }))
      )
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // ✅ SOLO navegar DESPUÉS de que termine todo
      console.log("🎯 Navegando a resultados con sessionId:", result.sessionId);
      router.push(`/dashboard/results?sessionId=${result.sessionId}`)
      
    } catch (error) {
      console.error("❌ Error completo:", error);
      const errorObj = error as Error;
      setStatus(`Error: ${errorObj.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <div className="bg-white rounded-xl p-8 shadow-sm">
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Importar Archivos para Conciliación
              </h2>
              <p className="text-gray-500 text-sm">
                Carga los archivos de ventas, compras y extracto bancario para iniciar el proceso de conciliación automática
              </p>
            </div>
            <Button
              onClick={() => router.push('/dashboard/multibank')}
              variant="outline"
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0"
            >
              🏦 Multi-Banco
            </Button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>💡 Nueva funcionalidad:</strong> ¿Tienes múltiples bancos? Usa la opción <strong>Multi-Banco</strong> para procesar hasta 10 extractos bancarios en una sola operación.
            </p>
          </div>
        </div>

        {/* Upload Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <FileUploadZone
            type="ventas"
            onFileSelect={handleFileSelect('ventas')}
            onFileRemove={handleFileRemove('ventas')}
            selectedFile={files.ventas}
            accept=".csv,.xlsx,.xls"
          />
          <FileUploadZone
            type="compras"
            onFileSelect={handleFileSelect('compras')}
            onFileRemove={handleFileRemove('compras')}
            selectedFile={files.compras}
            accept=".csv,.xlsx,.xls"
          />
          <FileUploadZone
            type="extracto"
            onFileSelect={handleFileSelect('extracto')}
            onFileRemove={handleFileRemove('extracto')}
            selectedFile={files.extracto}
            accept=".csv,.xlsx,.xls,.pdf"
          />
        </div>

        {/* Controls */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Label htmlFor="banco" className="text-sm font-medium text-gray-600">
              Banco:
            </Label>
            <Select value={banco} onValueChange={setBanco}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANCOS.map(banco => (
                  <SelectItem key={banco} value={banco}>
                    {banco}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="periodo" className="text-sm font-medium text-gray-600">
              Período:
            </Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map(periodo => (
                  <SelectItem key={periodo} value={periodo}>
                    {periodo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1" />
          
          <Button variant="outline" onClick={resetFiles}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Limpiar
          </Button>
          
          <Button 
            onClick={processConciliation} 
            disabled={!allFilesUploaded || isProcessing}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Procesar Conciliación
          </Button>
        </div>
      </div>

      {/* Processing Modal */}
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


