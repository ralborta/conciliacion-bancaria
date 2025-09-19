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
      return;
    }

    setIsDownloading(true);
    
    try {
      const response = await fetch(`/api/conciliation/export/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Obtener el nombre del archivo desde el header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `conciliacion_${sessionId}.xlsx`;

      // Crear blob y descargar
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // Mostrar estado de éxito
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error al descargar el archivo. Por favor, inténtalo de nuevo.');
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
