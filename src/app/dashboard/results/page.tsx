'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DebugAsientos } from '@/components/conciliacion/DebugAsientos';
import CollapsibleMovement from '@/components/ui/collapsible-movement';
import { DownloadButton } from '@/components/ui/download-button';

function ResultsContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [conciliatedMovements, setConciliatedMovements] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  
  // Función para manejar conciliación manual
  const handleManualConciliation = (movementId: string) => {
    setConciliatedMovements(prev => new Set([...prev, movementId]));
    
    // Actualizar el estado del movimiento en los datos
    if (data && data.movements) {
      const updatedMovements = data.movements.map((mov: any) => {
        if (mov.referencia === movementId || mov.id === movementId) {
          return {
            ...mov,
            estado: 'conciliado',
            reason: 'Conciliado manualmente por el usuario'
          };
        }
        return mov;
      });
      
      setData({
        ...data,
        movements: updatedMovements,
        conciliados: data.conciliados + 1,
        pendientes: data.pendientes - 1,
        porcentajeConciliado: ((data.conciliados + 1) / data.totalMovimientos) * 100
      });
    }
  };
  
  useEffect(() => {
    console.log('🔍 ResultsPage - Iniciando carga de datos');
    console.log('🔍 SessionId desde URL:', sessionId);
    
    // Primero intentar cargar de localStorage
    const storedData = localStorage.getItem('conciliationData');
    const storedSessionId = localStorage.getItem('currentSessionId');
    
    console.log('🔍 Datos en localStorage:', {
      storedData: storedData ? 'SÍ' : 'NO',
      storedSessionId: storedSessionId || 'NO'
    });
    
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        console.log('✅ Datos cargados de localStorage:', parsed);
        setData(parsed);
        setLoading(false);
        return;
      } catch (error) {
        console.error('❌ Error parseando datos de localStorage:', error);
      }
    }
    
    if (sessionId) {
      // Si no hay en localStorage, buscar por sessionId
      console.log('🔍 Buscando datos por sessionId:', sessionId);
      fetchResults(sessionId);
    } else {
      setLoading(false);
    }
  }, [sessionId]);
  
  const fetchResults = async (id: string) => {
    try {
      console.log('🔍 Llamando a API de resultados:', `/api/conciliation/results/${id}`);
      const response = await fetch(`/api/conciliation/results/${id}`);
      const result = await response.json();
      console.log('📥 Respuesta de API:', result);
      
      if (result.success && result.data) {
        setData(result.data);
        // Guardar en localStorage para futuras visitas
        localStorage.setItem('conciliationData', JSON.stringify(result.data));
        localStorage.setItem('currentSessionId', id);
      }
    } catch (error) {
      console.error('❌ Error cargando resultados:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="text-xl mb-4">Cargando resultados...</div>
          <div className="text-gray-500">SessionId: {sessionId}</div>
        </div>
      </div>
    );
  }
  
  // Si no hay datos, mostrar los mock para probar
  if (!data) {
    console.log('⚠️ No hay datos, mostrando datos de prueba');
    
    // TEMPORAL: Datos de prueba
    const mockData = {
      totalMovimientos: 128,
      conciliados: 76,
      pendientes: 52,
      porcentajeConciliado: 59,
      montoTotal: 65234789,
      movements: Array.from({ length: 10 }, (_, i) => ({
        id: `mock_${i}`,
        fecha: new Date().toISOString().split('T')[0],
        concepto: `Movimiento de prueba ${i + 1}`,
        monto: Math.random() * 10000 - 5000,
        tipo: Math.random() > 0.5 ? 'Crédito' : 'Débito',
        estado: 'pending'
      }))
    };
    
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl text-yellow-600">⚠️ Resultados de Conciliación (Datos de Prueba)</h2>
          {sessionId && (
            <DownloadButton 
              sessionId={sessionId} 
              variant="outline"
              size="default"
              className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
            />
          )}
        </div>
        <div className="text-sm text-gray-500 mb-4">
          No se pudieron cargar los datos reales. Mostrando datos de prueba.
        </div>
        
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">Total Movimientos</div>
            <div className="text-2xl font-bold">{mockData.totalMovimientos}</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">Conciliados</div>
            <div className="text-2xl font-bold text-green-600">{mockData.conciliados}</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">Pendientes</div>
            <div className="text-2xl font-bold text-orange-600">{mockData.pendientes}</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">% Conciliado</div>
            <div className="text-2xl font-bold text-blue-600">{mockData.porcentajeConciliado}%</div>
          </div>
        </div>
        
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-lg font-bold mb-4">Movimientos de Prueba</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Concepto</th>
                  <th className="text-right p-2">Monto</th>
                  <th className="text-center p-2">Tipo</th>
                  <th className="text-center p-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {mockData.movements.map((mov, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{mov.fecha}</td>
                    <td className="p-2">{mov.concepto}</td>
                    <td className="p-2 text-right">${mov.monto.toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        mov.tipo === 'Crédito' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {mov.tipo}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        mov.estado === 'conciliado' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`} title={(mov as any).reason || mov.estado}>
                        {mov.estado}
                        {(mov as any).reason && (mov as any).reason !== 'Sin conciliar' && (
                          <div className="text-xs text-gray-600 mt-1">
                            {(mov as any).reason}
                          </div>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  
  // Mostrar datos reales
  console.log('✅ Mostrando datos reales:', data);
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl text-green-600">✅ Resultados de Conciliación</h2>
        {sessionId && (
          <DownloadButton 
            sessionId={sessionId} 
            variant="default"
            size="default"
            className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
          />
        )}
      </div>
      
      {/* 🚨 AGREGAR COMPONENTE DE DEBUG TEMPORALMENTE */}
      <DebugAsientos results={data} />
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">Total Movimientos</div>
          <div className="text-2xl font-bold">{data.totalMovimientos || 0}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">Conciliados</div>
          <div className="text-2xl font-bold text-green-600">{data.conciliados || 0}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">Pendientes</div>
          <div className="text-2xl font-bold text-orange-600">{data.pendientes || 0}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-gray-500 text-sm">% Conciliado</div>
          <div className="text-2xl font-bold text-blue-600">{data.porcentajeConciliado || 0}%</div>
        </div>
      </div>

      {/* Información Multi-Banco */}
      {data.isMultiBank && data.bankSteps && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-purple-800 mb-3">
            🏦 Proceso Multi-Banco
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.bankSteps.map((step: any, index: number) => (
              <div key={index} className={`border rounded-lg p-3 ${
                step.matchedCount === 0 && step.pendingCount === 0
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-white border-purple-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-medium ${
                    step.matchedCount === 0 && step.pendingCount === 0
                      ? 'text-yellow-800'
                      : 'text-purple-800'
                  }`}>
                    Banco #{index + 1}
                    {step.matchedCount === 0 && step.pendingCount === 0 && (
                      <span className="text-xs ml-2">⚠️ Sin pendientes</span>
                    )}
                  </h4>
                  <span className="text-xs text-purple-600">
                    {new Date(step.processedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Conciliadas:</span>
                    <span className="font-medium text-green-600">{step.matchedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pendientes:</span>
                    <span className="font-medium text-orange-600">{step.pendingCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ventas:</span>
                    <span className="font-medium">{step.ventasConciliadas}/{step.totalVentas}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Compras:</span>
                    <span className="font-medium">{step.comprasConciliadas}/{step.totalCompras}</span>
                  </div>
                  {step.matchedCount === 0 && step.pendingCount === 0 && (
                    <div className="mt-2 text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
                      No había transacciones pendientes para conciliar con este banco
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje especial cuando no hay transacciones pendientes */}
      {data.noPendingTransactions && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 text-lg">ℹ️</span>
              </div>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                No hay transacciones pendientes
              </h3>
              <p className="text-yellow-700 mb-4">
                El banco que acabas de procesar no tenía transacciones pendientes para conciliar. 
                Esto significa que todas las transacciones ya fueron conciliadas en bancos anteriores.
              </p>
              <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-3">
                <h4 className="font-medium text-yellow-800 mb-2">✅ Estado actual:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Todas las transacciones han sido procesadas</li>
                  <li>• No quedan transacciones pendientes para conciliar</li>
                  <li>• El proceso multi-banco está completo</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay coincidencias */}
      {data.porcentajeConciliado === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-lg">⚠️</span>
              </div>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                No se encontraron coincidencias
              </h3>
              <p className="text-red-700 mb-4">
                {data.isMultiBank 
                  ? "Este banco no concilió transacciones adicionales. Las transacciones pendientes pueden coincidir con otro banco."
                  : "No se encontraron coincidencias entre las transacciones y el extracto bancario. Esto puede deberse a diferencias en fechas, montos o conceptos."
                }
              </p>
              <div className="bg-red-100 border border-red-200 rounded-lg p-3 mb-4">
                <h4 className="font-medium text-red-800 mb-2">💡 Sugerencias:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Verificar que las fechas coincidan con el período del extracto</li>
                  <li>• Revisar que los montos sean exactos (sin diferencias de centavos)</li>
                  <li>• Comprobar que los conceptos o referencias sean similares</li>
                  <li>• Probar con otro banco que pueda tener las transacciones</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando hay pocas coincidencias */}
      {data.porcentajeConciliado > 0 && data.porcentajeConciliado < 30 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 text-lg">⚠️</span>
              </div>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                Pocas coincidencias encontradas
              </h3>
              <p className="text-yellow-700 mb-4">
                Solo se concilió el {data.porcentajeConciliado.toFixed(1)}% de las transacciones. 
                {data.isMultiBank 
                  ? " Puedes probar con otro banco para mejorar la conciliación."
                  : " Considera revisar los datos o probar con otro banco."
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Botón para agregar otro banco - Siempre visible y destacado */}
      <div className={`border rounded-lg p-4 mb-6 ${
        data.porcentajeConciliado === 0 
          ? 'bg-red-50 border-red-200' 
          : data.porcentajeConciliado < 30 
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-semibold mb-1 ${
              data.porcentajeConciliado === 0 
                ? 'text-red-800' 
                : data.porcentajeConciliado < 30 
                ? 'text-yellow-800'
                : 'text-blue-800'
            }`}>
              {data.porcentajeConciliado === 0 
                ? '🚨 ¿Probar con Otro Banco?' 
                : data.porcentajeConciliado < 30
                ? '⚠️ ¿Mejorar con Otro Banco?'
                : '🏦 ¿Agregar Otro Banco?'
              }
            </h3>
            <p className={`text-sm ${
              data.porcentajeConciliado === 0 
                ? 'text-red-600' 
                : data.porcentajeConciliado < 30 
                ? 'text-yellow-600'
                : 'text-blue-600'
            }`}>
              {data.porcentajeConciliado === 0 
                ? 'Procesa otro banco que pueda tener las transacciones pendientes'
                : data.porcentajeConciliado < 30
                ? 'Procesa otro banco para conciliar más transacciones pendientes'
                : 'Procesa otro banco con las transacciones pendientes de este resultado'
              }
            </p>
          </div>
          <button
            onClick={() => {
              // Guardar datos actuales para el siguiente banco
              console.log('💾 Guardando datos para siguiente banco:', data);
              localStorage.setItem('multiBankData', JSON.stringify(data));
              localStorage.setItem('multiBankSessionId', sessionId || '');
              
              // Guardar también los datos de conciliación para compatibilidad
              localStorage.setItem('conciliationData', JSON.stringify(data));
              localStorage.setItem('currentSessionId', sessionId || '');
              
              // Redirigir a la página de siguiente banco
              window.location.href = '/dashboard/next-bank';
            }}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              data.porcentajeConciliado === 0 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : data.porcentajeConciliado < 30 
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {data.porcentajeConciliado === 0 
              ? 'Probar Otro Banco' 
              : data.porcentajeConciliado < 30
              ? 'Mejorar Conciliación'
              : 'Agregar Banco'
            }
          </button>
        </div>
      </div>
      
      {data.movements && data.movements.length > 0 && (
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-lg font-bold mb-4">Movimientos Bancarios ({data.movements.length})</h3>
          <div className="space-y-2">
            {data.movements.slice(0, 20).map((mov: any, i: number) => (
              <CollapsibleMovement 
                key={i} 
                movement={{
                  fecha: mov.fecha,
                  concepto: mov.concepto,
                  monto: mov.monto || 0,
                  tipo: mov.tipo,
                  estado: mov.estado,
                  reason: (mov as any).reason,
                  referencia: mov.referencia,
                  banco: mov.banco,
                  cuenta: mov.cuenta,
                  onConciliate: handleManualConciliation,
                  matchingDetails: (mov as any).matchingDetails
                }}
                index={i}
              />
            ))}
          </div>
        </div>
      )}
      
      {data.compras && data.compras.length > 0 && (
        <div className="bg-white rounded shadow p-4 mt-4">
          <h3 className="text-lg font-bold mb-4">Compras ({data.compras.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Proveedor</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-center p-2">Nro. de Factura</th>
                </tr>
              </thead>
              <tbody>
                {data.compras.slice(0, 10).map((compra: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{compra.fecha}</td>
                    <td className="p-2">{compra.proveedor}</td>
                    <td className="p-2 text-right">${compra.total?.toFixed(2) || '0.00'}</td>
                    <td className="p-2 text-center">{compra.numero}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {data.impuestos && data.impuestos.length > 0 && (
        <div className="bg-white rounded shadow p-4 mt-4">
          <h3 className="text-lg font-bold mb-4">Impuestos ({data.impuestos.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Concepto</th>
                  <th className="text-right p-2">Monto</th>
                  <th className="text-center p-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {data.impuestos.slice(0, 10).map((impuesto: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{impuesto.fecha}</td>
                    <td className="p-2">{impuesto.concepto}</td>
                    <td className="p-2 text-right">${impuesto.monto?.toFixed(2) || '0.00'}</td>
                    <td className="p-2 text-center">{impuesto.tipo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="text-center">
          <div className="text-xl mb-4">Cargando...</div>
        </div>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}