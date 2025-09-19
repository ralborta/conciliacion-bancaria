'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2, CheckCircle } from 'lucide-react';

interface DownloadButtonProps {
  sessionId: string;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function DownloadButton({ 
  sessionId, 
  className = '',
  variant = 'default',
  size = 'default'
}: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownload = async () => {
    if (!sessionId) {
      console.error('No sessionId provided for download');
      alert('No se encontró el ID de sesión para la descarga.');
      return;
    }

    setIsDownloading(true);
    
    try {
      console.log('Iniciando descarga para sessionId:', sessionId);
      const response = await fetch(`/api/conciliation/export/${sessionId}`);
      
      console.log('Respuesta del servidor:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error del servidor:', errorData);
        throw new Error(`Error ${response.status}: ${errorData.error || response.statusText}`);
      }

      // Verificar que la respuesta sea un archivo Excel
      const contentType = response.headers.get('Content-Type');
      console.log('Content-Type:', contentType);
      
      if (!contentType?.includes('spreadsheetml')) {
        const text = await response.text();
        console.error('Respuesta no es un archivo Excel:', text);
        throw new Error('El servidor no devolvió un archivo Excel válido');
      }

      // Obtener el nombre del archivo desde el header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `conciliacion_${sessionId}.xlsx`;

      console.log('Nombre del archivo:', filename);

      // Crear blob y descargar
      const blob = await response.blob();
      console.log('Tamaño del blob:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('El archivo está vacío');
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // Mostrar estado de éxito
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      alert(`Error al descargar el archivo: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={isDownloading || !sessionId}
      variant={variant}
      size={size}
      className={`gap-2 transition-all duration-200 ${className} ${
        downloadSuccess ? 'bg-green-600 hover:bg-green-700' : ''
      }`}
    >
      {isDownloading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Descargando...</span>
        </>
      ) : downloadSuccess ? (
        <>
          <CheckCircle className="h-4 w-4" />
          <span>¡Descargado!</span>
        </>
      ) : (
        <>
          <FileSpreadsheet className="h-4 w-4" />
          <span>Descargar Excel</span>
        </>
      )}
    </Button>
  );
}
