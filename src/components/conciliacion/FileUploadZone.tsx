'use client'

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { UploadedFile } from '@/lib/types/conciliacion'

interface FileUploadZoneProps {
  type: 'ventas' | 'compras' | 'extracto'
  onFileSelect: (file: UploadedFile) => void
  onFileRemove: () => void
  selectedFile?: UploadedFile | null
  accept: string
}

const fileConfig = {
  ventas: {
    icon: '📊',
    label: 'VENTAS',
    hint: 'Arrastra tu archivo o haz clic para seleccionar'
  },
  compras: {
    icon: '🛒',
    label: 'COMPRAS',
    hint: 'Arrastra tu archivo o haz clic para seleccionar'
  },
  extracto: {
    icon: '🏦',
    label: 'EXTRACTO BANCARIO',
    hint: 'Arrastra tu archivo o haz clic para seleccionar'
  }
}

export default function FileUploadZone({
  type,
  onFileSelect,
  onFileRemove,
  selectedFile,
  accept
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const config = fileConfig[type]

  const handleFileSelect = useCallback((file: File) => {
    const uploadedFile: UploadedFile = {
      file,
      type,
      name: file.name,
      size: file.size
    }
    onFileSelect(uploadedFile)
  }, [type, onFileSelect])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFileRemove()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 cursor-pointer relative bg-gray-50',
        isDragOver && 'border-blue-500 bg-blue-50 transform -translate-y-0.5 shadow-lg shadow-blue-500/15',
        selectedFile && 'border-green-500 bg-gradient-to-br from-green-50 to-green-100 border-solid',
        !selectedFile && !isDragOver && 'border-gray-300 hover:border-blue-500 hover:bg-white hover:transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/15'
      )}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      <div className="text-4xl mb-4">{config.icon}</div>
      <div className="font-semibold text-gray-700 mb-2">{config.label}</div>
      <div className="text-xs text-gray-500 mb-4">{config.hint}</div>
      
      {selectedFile ? (
        <div className="flex items-center justify-center gap-2 text-green-600 font-medium text-sm">
          <span>✅</span>
          <span className="truncate max-w-[200px]">{selectedFile.name}</span>
          <button
            onClick={handleRemove}
            className="ml-2 text-red-500 hover:text-red-700 text-lg"
            title="Eliminar archivo"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  )
}



