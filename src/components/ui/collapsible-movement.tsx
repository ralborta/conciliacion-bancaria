'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface MovementDetails {
  fecha: string;
  concepto: string;
  monto: number;
  tipo: string;
  estado: string;
  reason?: string;
  referencia?: string;
  banco?: string;
  cuenta?: string;
  onConciliate?: (id: string) => void;
  matchingDetails?: {
    matchedWith: any;
    tipoDocumento: string;
    score: number;
    documentoInfo: {
      fecha: string;
      monto: number;
      cliente: string;
      numero: string;
    } | null;
  };
}

interface CollapsibleMovementProps {
  movement: MovementDetails;
  index: number;
}

export default function CollapsibleMovement({ movement, index }: CollapsibleMovementProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'conciliado':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTipoColor = (tipo: string) => {
    return tipo === 'Crédito' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  return (
    <div className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
      {/* Header clickeable */}
      <div 
        className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          {/* Icono de flecha */}
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-gray-500" />
            )}
          </div>
          
          {/* Información principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <span className="text-sm font-medium text-gray-900">
                  {movement.fecha}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">
                  {movement.concepto}
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="text-sm font-semibold text-gray-900">
                  ${Math.abs(movement.monto).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Badges de estado y tipo */}
        <div className="flex items-center space-x-2 ml-4">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTipoColor(movement.tipo)}`}>
            {movement.tipo}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(movement.estado)}`}>
            {movement.estado}
          </span>
        </div>
      </div>

      {/* Contenido expandible */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Detalles del movimiento */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Detalles del Movimiento</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha:</span>
                  <span className="text-gray-900">{movement.fecha}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Concepto:</span>
                  <span className="text-gray-900">{movement.concepto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monto:</span>
                  <span className="text-gray-900 font-semibold">${Math.abs(movement.monto).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="text-gray-900">{movement.tipo}</span>
                </div>
                {movement.referencia && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Referencia:</span>
                    <span className="text-gray-900">{movement.referencia}</span>
                  </div>
                )}
              </div>
            </div>

          {/* Información bancaria y estado */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Información Bancaria</h4>
            <div className="space-y-1 text-sm">
              {movement.banco && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Banco:</span>
                  <span className="text-gray-900">{movement.banco}</span>
                </div>
              )}
              {movement.cuenta && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Cuenta:</span>
                  <span className="text-gray-900">{movement.cuenta}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(movement.estado)}`}>
                  {movement.estado}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Comparación de Matching */}
        {movement.matchingDetails?.documentoInfo && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Comparación de Matching
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Información del Banco */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h5 className="text-sm font-semibold text-blue-800 mb-2">📊 Movimiento Bancario</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">Fecha:</span>
                    <span className="text-blue-900 font-medium">{movement.fecha}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Monto:</span>
                    <span className="text-blue-900 font-medium">${Math.abs(movement.monto).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Concepto:</span>
                    <span className="text-blue-900 font-medium">{movement.concepto}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Tipo:</span>
                    <span className="text-blue-900 font-medium">{movement.tipo}</span>
                  </div>
                </div>
              </div>

              {/* Información del Documento */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h5 className="text-sm font-semibold text-green-800 mb-2">
                  📄 {movement.matchingDetails.tipoDocumento === 'venta' ? 'Venta' : 'Compra'}
                </h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-600">Fecha:</span>
                    <span className="text-green-900 font-medium">{movement.matchingDetails.documentoInfo.fecha}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Monto:</span>
                    <span className="text-green-900 font-medium">${movement.matchingDetails.documentoInfo.monto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Cliente/Proveedor:</span>
                    <span className="text-green-900 font-medium">{movement.matchingDetails.documentoInfo.cliente}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Número:</span>
                    <span className="text-green-900 font-medium">{movement.matchingDetails.documentoInfo.numero}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Análisis de Diferencias */}
            <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <h6 className="text-xs font-semibold text-gray-700 mb-2">🔍 Análisis de Diferencias</h6>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-600">Diferencia de Monto:</span>
                  <span className={`ml-1 font-medium ${
                    Math.abs(movement.monto - movement.matchingDetails.documentoInfo.monto) < 1 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    ${Math.abs(movement.monto - movement.matchingDetails.documentoInfo.monto).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Score de Matching:</span>
                  <span className={`ml-1 font-medium ${
                    movement.matchingDetails.score > 0.8 
                      ? 'text-green-600' 
                      : movement.matchingDetails.score > 0.5 
                        ? 'text-yellow-600' 
                        : 'text-red-600'
                  }`}>
                    {(movement.matchingDetails.score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
          </div>

          {/* Razón de Pendiente - Destacada */}
          {movement.estado === 'pending' && movement.reason && movement.reason !== 'Sin procesar' && (
            <div className="mt-4 pt-4 border-t border-yellow-200">
              <h4 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Razón de Pendiente
              </h4>
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800 font-medium">{movement.reason}</p>
                <div className="mt-2 text-xs text-yellow-700">
                  <p>Este movimiento no pudo ser conciliado automáticamente. Revisa los detalles y marca como conciliado si corresponde.</p>
                </div>
              </div>
            </div>
          )}

          {/* Razón de Conciliación */}
          {movement.estado === 'conciliado' && movement.reason && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Razón de Conciliación
              </h4>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 font-medium">{movement.reason}</p>
              </div>
            </div>
          )}

          {/* Checkbox para Conciliación Manual */}
          {movement.estado === 'pending' && movement.onConciliate && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`conciliate-${index}`}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onChange={(e) => {
                      if (e.target.checked) {
                        movement.onConciliate?.(movement.referencia || `mov_${index}`);
                      }
                    }}
                  />
                  <label htmlFor={`conciliate-${index}`} className="ml-2 text-sm font-medium text-blue-800">
                    Marcar como conciliado manualmente
                  </label>
                </div>
                <span className="text-xs text-blue-600">
                  ✓ Confirmar conciliación
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
