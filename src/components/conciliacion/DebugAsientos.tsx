// 🚨 AGREGAR ESTO TEMPORALMENTE EN TU COMPONENTE DE RESULTADOS
// (Después te doy la versión final bonita)

export function DebugAsientos({ results }: { results: any }) {
  console.log('🔍 Results completos:', results);
  console.log('🔍 Asientos contables:', results?.asientosContables);
  console.log('🔍 Asientos resumen:', results?.asientosResumen);

  return (
    <div className="border-2 border-red-500 p-4 m-4 bg-red-50">
      <h2 className="text-lg font-bold text-red-800">🚨 DEBUG - ASIENTOS CONTABLES</h2>
      
      <div className="mt-2">
        <p><strong>Total asientos:</strong> {results?.asientosContables?.length || 0}</p>
        <p><strong>Debug info:</strong> {JSON.stringify(results?.debug || {})}</p>
      </div>

      {results?.asientosContables && results.asientosContables.length > 0 ? (
        <div className="mt-4">
          <h3 className="font-bold">✅ ASIENTOS ENCONTRADOS:</h3>
          <table className="w-full border mt-2 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1">Cuenta</th>
                <th className="border p-1">Debe</th>
                <th className="border p-1">Haber</th>
              </tr>
            </thead>
            <tbody>
              {results.asientosContables.map((asiento: any, index: number) => (
                <tr key={index}>
                  <td className="border p-1">{asiento.cuenta}</td>
                  <td className="border p-1 text-right">${asiento.debe.toLocaleString()}</td>
                  <td className="border p-1 text-right">${asiento.haber.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 text-red-600">
          ❌ NO SE ENCONTRARON ASIENTOS CONTABLES
        </div>
      )}
    </div>
  );
}
