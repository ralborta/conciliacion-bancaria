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

          {/* Comentario/Observación */}
          {movement.reason && movement.reason !== 'Sin procesar' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Observación</h4>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">{movement.reason}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
