import React, { useState } from 'react';

export function DebugAsientos({ results }: { results: any }) {
  const [isOpen, setIsOpen] = useState(false);
  
  console.log('🔍 Results completos:', results);
  console.log('🔍 Asientos contables:', results?.asientosContables);
  console.log('🔍 Asientos resumen:', results?.asientosResumen);

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-lg font-semibold text-gray-700">
          🔍 Debug - Asientos Contables ({results?.asientosContables?.length || 0})
        </h3>
        <span className="text-gray-500">
          {isOpen ? '▼' : '▶'}
        </span>
      </button>
      
      {isOpen && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Total asientos:</strong> {results?.asientosContables?.length || 0}
            </div>
            <div>
              <strong>Debug info:</strong> {JSON.stringify(results?.debug || {})}
            </div>
          </div>

          {results?.asientosContables && results.asientosContables.length > 0 ? (
            <div>
              <h4 className="font-semibold text-green-700 mb-2">✅ Asientos Encontrados:</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Cuenta</th>
                      <th className="border border-gray-300 p-2 text-right">Debe</th>
                      <th className="border border-gray-300 p-2 text-right">Haber</th>
                      <th className="border border-gray-300 p-2 text-left">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.asientosContables.map((asiento: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">{asiento.cuenta}</td>
                        <td className="border border-gray-300 p-2 text-right">
                          {asiento.debe > 0 ? `$${asiento.debe.toLocaleString()}` : '-'}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {asiento.haber > 0 ? `$${asiento.haber.toLocaleString()}` : '-'}
                        </td>
                        <td className="border border-gray-300 p-2 text-xs text-gray-600">
                          {asiento.descripcion || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-red-600 font-medium">
              ❌ No se encontraron asientos contables
            </div>
          )}
        </div>
      )}
    </div>
  );
}