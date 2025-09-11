'use client'

import { MatchResult } from '@/lib/types/conciliacion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface MatchingDetailsProps {
  result: MatchResult | null
  isOpen: boolean
  onClose: () => void
  onAccept?: (result: MatchResult) => void
  onReject?: (result: MatchResult) => void
}

export default function MatchingDetails({
  result,
  isOpen,
  onClose,
  onAccept,
  onReject
}: MatchingDetailsProps) {
  if (!result) return null

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalles de Conciliación</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Extracto Bancario */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-3">Extracto Bancario</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Fecha:</span>
                <span className="ml-2 font-medium">{formatDate(result.extractoItem.fechaOperacion)}</span>
              </div>
              <div>
                <span className="text-gray-600">Importe:</span>
                <span className={`ml-2 font-semibold ${
                  result.extractoItem.importe >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatAmount(result.extractoItem.importe)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Concepto:</span>
                <span className="ml-2 font-medium">{result.extractoItem.concepto}</span>
              </div>
              {result.extractoItem.referencia && (
                <div className="col-span-2">
                  <span className="text-gray-600">Referencia:</span>
                  <span className="ml-2 font-mono text-xs">{result.extractoItem.referencia}</span>
                </div>
              )}
            </div>
          </div>

          {/* Match Details */}
          {result.matchedWith ? (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-3">
                {result.tipo === 'venta' ? 'Venta' : 'Compra'} Conciliada
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Fecha:</span>
                  <span className="ml-2 font-medium">
                    {formatDate(result.matchedWith.fechaEmision)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {formatAmount(result.matchedWith.total)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Referencia:</span>
                  <span className="ml-2 font-mono text-xs">
                    {result.matchedWith.referenciaExterna || '-'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-3">Sin Conciliación</h4>
              <p className="text-sm text-yellow-800">
                No se encontró una coincidencia automática para este movimiento.
              </p>
            </div>
          )}

          {/* Match Score */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-3">Información de Matching</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Puntuación:</span>
                <Badge variant={result.score >= 0.9 ? 'default' : 'secondary'}>
                  {Math.round(result.score * 100)}%
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <Badge variant={
                  result.status === 'matched' ? 'default' : 
                  result.status === 'suggested' ? 'secondary' : 'destructive'
                }>
                  {result.status}
                </Badge>
              </div>
              {result.reason && (
                <div>
                  <span className="text-gray-600">Razón:</span>
                  <span className="ml-2 text-gray-800">{result.reason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {result.status === 'suggested' && (
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => onReject?.(result)}>
                Rechazar
              </Button>
              <Button onClick={() => onAccept?.(result)}>
                Aceptar Conciliación
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
