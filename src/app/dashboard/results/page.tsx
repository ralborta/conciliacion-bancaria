'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DebugAsientos } from '@/components/conciliacion/DebugAsientos';

function ResultsContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  
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
        <h2 className="text-xl mb-4 text-yellow-600">⚠️ Resultados de Conciliación (Datos de Prueba)</h2>
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
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                        {mov.estado}
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
      <h2 className="text-xl mb-4 text-green-600">✅ Resultados de Conciliación</h2>
      
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
      
      {data.movements && data.movements.length > 0 && (
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-lg font-bold mb-4">Movimientos Bancarios</h3>
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
                {data.movements.slice(0, 20).map((mov: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{mov.fecha}</td>
                    <td className="p-2">{mov.concepto}</td>
                    <td className="p-2 text-right">${mov.monto?.toFixed(2) || '0.00'}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        mov.tipo === 'Crédito' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {mov.tipo}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                        {mov.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <th className="text-center p-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {data.compras.slice(0, 10).map((compra: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{compra.fecha}</td>
                    <td className="p-2">{compra.proveedor}</td>
                    <td className="p-2 text-right">${compra.total?.toFixed(2) || '0.00'}</td>
                    <td className="p-2 text-center">{compra.tipo}</td>
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