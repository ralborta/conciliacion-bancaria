import { NextRequest, NextResponse } from 'next/server'
import { ConciliationEngine } from '@/lib/engine/matcher'
import { memoryStorage } from '@/lib/storage/memory'
import { ProcessOptions, ConciliationStats } from '@/lib/types/conciliacion'

// ===== DEBUG: POR QUÉ NO SALEN RESULTADOS =====

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  console.log("🚀 API LLAMADA - Inicio");
  console.log("🔍 Request headers:", Object.fromEntries(request.headers.entries()));
  console.log("🔍 Request method:", request.method);
  console.log("🔍 Request URL:", request.url);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  
  try {
    console.log("📥 Parseando formData...");
    const formData = await request.formData()
    console.log("✅ FormData parseado exitosamente");
    
    const ventasFile = formData.get('ventas') as File
    const comprasFile = formData.get('compras') as File
    const extractoFile = formData.get('extracto') as File
    const banco = formData.get('banco') as string
    const periodo = formData.get('periodo') as string
    
    console.log("📥 Archivos recibidos:", {
      ventas: ventasFile?.name || 'No file',
      compras: comprasFile?.name || 'No file', 
      extracto: extractoFile?.name || 'No file',
      banco: banco || 'No banco',
      periodo: periodo || 'No periodo'
    });
    
    // VERIFICAR que los datos lleguen
    if (!ventasFile || !comprasFile || !extractoFile || !banco || !periodo) {
      console.error("❌ DATOS FALTANTES:", { 
        tieneVentas: !!ventasFile,
        tieneCompras: !!comprasFile, 
        tieneExtracto: !!extractoFile,
        tieneBanco: !!banco,
        tienePeriodo: !!periodo
      });
      return NextResponse.json({ error: "Datos faltantes" }, { status: 400, headers: corsHeaders });
    }

    console.log("🔄 Iniciando procesamiento...");
    
    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log("🆔 Session ID:", sessionId);
    
    // Save files to storage
    await memoryStorage.saveFile(sessionId, {
      file: ventasFile,
      type: 'ventas',
      name: ventasFile.name,
      size: ventasFile.size
    })
    
    await memoryStorage.saveFile(sessionId, {
      file: comprasFile,
      type: 'compras',
      name: comprasFile.name,
      size: comprasFile.size
    })
    
    await memoryStorage.saveFile(sessionId, {
      file: extractoFile,
      type: 'extracto',
      name: extractoFile.name,
      size: extractoFile.size
    })
    
    console.log("💾 Archivos guardados en storage");
    
    // PROCESAR con logging
    const resultado = await procesarConciliacionConDebug(ventasFile, comprasFile, extractoFile, banco, periodo);
    
    console.log("✅ Procesamiento completo:", {
      totalResultados: resultado.length || 0,
      tiposResultados: resultado?.map?.(r => r.status) || 'No array'
    });

    // Calculate stats
    const stats: ConciliationStats = {
      totalMovimientos: resultado.length,
      conciliados: resultado.filter(r => r.status === 'matched').length,
      pendientes: resultado.filter(r => r.status === 'pending').length,
      montoTotal: resultado.reduce((sum, r) => sum + Math.abs(r.extractoItem?.importe || 0), 0),
      porcentajeConciliacion: resultado.length > 0 
        ? (resultado.filter(r => r.status === 'matched').length / resultado.length) * 100 
        : 0
    }
    
    // Save results and stats
    await memoryStorage.saveResults(sessionId, resultado)
    await memoryStorage.saveStats(sessionId, stats)
    await memoryStorage.saveSession(sessionId, {
      banco,
      periodo,
      createdAt: new Date(),
      status: 'completed'
    })

    console.log("📤 Enviando respuesta final:", {
      success: true,
      sessionId,
      totalResults: resultado.length,
      stats,
      debug: {
        timestamp: new Date().toISOString(),
        totalProcessed: resultado.length || 0
      }
    });

    return NextResponse.json({ 
      success: true, 
      sessionId,
      results: resultado,
      stats,
      debug: {
        timestamp: new Date().toISOString(),
        totalProcessed: resultado.length || 0
      }
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error("❌ ERROR EN API:", error);
    const errorObj = error as Error;
    console.error("Stack:", errorObj.stack);
    
    return NextResponse.json({ 
      success: false, 
      error: errorObj.message,
      stack: errorObj.stack 
    }, { status: 500, headers: corsHeaders });
  }
}

// 2. FUNCIÓN DE PROCESAMIENTO CON DEBUG INTENSIVO
async function procesarConciliacionConDebug(ventasFile: File, comprasFile: File, extractoFile: File, banco: string, periodo: string) {
  console.log("🔍 DEBUGGING PASO A PASO:");
  
  try {
    // PASO 1: Parsear archivos
    console.log("PASO 1 - Parseando archivos...");
    console.log("📁 Archivos recibidos:", {
      ventas: { name: ventasFile.name, size: ventasFile.size, type: ventasFile.type },
      compras: { name: comprasFile.name, size: comprasFile.size, type: comprasFile.type },
      extracto: { name: extractoFile.name, size: extractoFile.size, type: extractoFile.type }
    });
    
    const engine = new ConciliationEngine();
    const options: ProcessOptions = { banco, periodo };
    
    // Parsear archivos individualmente para debug
    console.log("🔄 Parseando ventas...");
    const ventasData = await parseFileToArray(ventasFile);
    console.log("✅ Ventas parseadas:", { 
      esArray: Array.isArray(ventasData), 
      length: ventasData?.length || 0,
      muestra: ventasData?.slice?.(0, 2) || "No es array"
    });
    
    console.log("🔄 Parseando compras...");
    const comprasData = await parseFileToArray(comprasFile);
    console.log("✅ Compras parseadas:", { 
      esArray: Array.isArray(comprasData), 
      length: comprasData?.length || 0,
      muestra: comprasData?.slice?.(0, 2) || "No es array"
    });
    
    console.log("🔄 Parseando extracto...");
    const extractoData = await parseFileToArray(extractoFile);
    console.log("✅ Extracto parseado:", { 
      esArray: Array.isArray(extractoData), 
      length: extractoData?.length || 0,
      muestra: extractoData?.slice?.(0, 2) || "No es array"
    });
    
    // PASO 2: Normalización con logging
    console.log("PASO 2 - Normalizando...");
    
    let ventasNormalizadas: any[] = [];
    let comprasNormalizadas: any[] = [];
    let extractoNormalizado: any[] = [];
    
    try {
      ventasNormalizadas = normalizarVentasConDebug(ventasData);
      console.log(`✅ Ventas normalizadas: ${ventasNormalizadas.length}`);
    } catch (error) {
      console.error("❌ Error normalizando ventas:", error);
    }
    
    try {
      comprasNormalizadas = normalizarComprasConDebug(comprasData);
      console.log(`✅ Compras normalizadas: ${comprasNormalizadas.length}`);
    } catch (error) {
      console.error("❌ Error normalizando compras:", error);
    }
    
    try {
      extractoNormalizado = normalizarExtractoConDebug(extractoData);
      console.log(`✅ Extracto normalizado: ${extractoNormalizado.length}`);
    } catch (error) {
      console.error("❌ Error normalizando extracto:", error);
    }
    
    // PASO 3: Matching con logging
    console.log("PASO 3 - Iniciando matching...");
    
    if (ventasNormalizadas.length === 0 && comprasNormalizadas.length === 0) {
      console.error("❌ NO HAY DATOS PARA CONCILIAR");
      return [{
        id: 'error_no_data',
        extractoItem: {
          id: 'dummy',
          banco: 'N/A',
          cuenta: 'N/A',
          fechaOperacion: new Date(),
          concepto: 'Error',
          importe: 0
        },
        matchedWith: null,
        score: 0,
        status: 'error' as const,
        reason: 'No hay datos válidos para conciliar'
      }];
    }
    
    if (extractoNormalizado.length === 0) {
      console.error("❌ NO HAY MOVIMIENTOS BANCARIOS");
      return [{
        id: 'error_no_extracto',
        extractoItem: {
          id: 'dummy',
          banco: 'N/A',
          cuenta: 'N/A',
          fechaOperacion: new Date(),
          concepto: 'Error',
          importe: 0
        },
        matchedWith: null,
        score: 0,
        status: 'error' as const, 
        reason: 'No hay movimientos bancarios válidos'
      }];
    }
    
    // MOTOR AVANZADO DE CONCILIACIÓN ARGENTINA
    console.log("🚀 Iniciando motor avanzado de conciliación...");
    console.log("📊 Datos a procesar:", {
      ventas: ventasNormalizadas.length,
      compras: comprasNormalizadas.length,
      extracto: extractoNormalizado.length,
      muestraVentas: ventasNormalizadas.slice(0, 2),
      muestraCompras: comprasNormalizadas.slice(0, 2),
      muestraExtracto: extractoNormalizado.slice(0, 2)
    });
    
    try {
      // Usar el motor avanzado que ya implementamos
      console.log("🔄 Llamando a engine.runMatching...");
      const resultados = await engine.runMatching(
        ventasNormalizadas,
        comprasNormalizadas, 
        extractoNormalizado
      );
      
      console.log("✅ Motor avanzado completado:", {
        totalResultados: resultados.length,
        matchesExactos: resultados.filter(r => r.score >= 0.9).length,
        matchesParciales: resultados.filter(r => r.score < 0.9 && r.score > 0).length,
        sinMatch: resultados.filter(r => r.score === 0).length,
        muestraResultados: resultados.slice(0, 3)
      });
      
      return resultados;
      
    } catch (error) {
      console.error("❌ Error en motor avanzado:", error);
      const errorObj = error as Error;
      
      // Fallback a matching básico si falla el motor avanzado
      console.log("🔄 Fallback a matching básico...");
      const resultados = [];
      let matchesEncontrados = 0;
      
      console.log("🔄 Procesando ventas...");
      for (let i = 0; i < Math.min(ventasNormalizadas.length, 10); i++) {
        const venta = ventasNormalizadas[i];
        console.log(`  Venta ${i + 1}: $${venta.total} - ${venta.cliente || 'Sin cliente'}`);
        
        // Buscar ingreso bancario similar
        const match = extractoNormalizado.find(mov => 
          mov.tipo === 'ingreso' && 
          Math.abs(mov.importe - venta.total) <= (venta.total * 0.05) // 5% tolerancia
        );
        
        if (match) {
          console.log(`    ✅ MATCH encontrado: $${match.importe}`);
          matchesEncontrados++;
          resultados.push({
            id: `venta_match_${i}`,
            extractoItem: match,
            matchedWith: venta,
            score: 0.9,
            status: 'matched' as const,
            tipo: 'venta' as const,
            reason: 'Match por importe (fallback)'
          });
        } else {
          console.log(`    ❌ Sin match`);
          resultados.push({
            id: `venta_no_match_${i}`,
            extractoItem: {
              id: 'dummy',
              banco: 'N/A',
              cuenta: 'N/A',
              fechaOperacion: new Date(),
              concepto: 'Sin match',
              importe: 0
            },
            matchedWith: venta,
            score: 0,
            status: 'pending' as const,
            tipo: 'venta' as const,
            reason: 'Sin conciliar (fallback)'
          });
        }
      }
      
      console.log(`📊 RESULTADO FALLBACK: ${matchesEncontrados} matches de ${Math.min(ventasNormalizadas.length, 10)} procesadas`);
      return resultados;
    }
    
  } catch (error) {
    console.error("❌ Error en procesamiento:", error);
    const errorObj = error as Error;
    return [{
      id: 'error_processing',
      extractoItem: {
        id: 'dummy',
        banco: 'N/A',
        cuenta: 'N/A',
        fechaOperacion: new Date(),
        concepto: 'Error',
        importe: 0
      },
      matchedWith: null,
      score: 0,
      status: 'error' as const,
      reason: `Error en procesamiento: ${errorObj.message}`
    }];
  }
}

// 3. FUNCIONES DE NORMALIZACIÓN CON DEBUG
function normalizarVentasConDebug(data: any[]) {
  console.log("🔍 Normalizando ventas - debug:");
  
  if (!Array.isArray(data)) {
    console.error("❌ Ventas no es array:", typeof data);
    return [];
  }
  
  console.log(`- Array recibido con ${data.length} elementos`);
  console.log(`- Primer elemento:`, data[0]);
  console.log(`- Segundo elemento:`, data[1]);
  console.log(`- Es array de arrays?:`, Array.isArray(data[0]));
  
  if (Array.isArray(data[0])) {
    // Formato Excel - VENTAS tienen primera línea en blanco
    console.log("📋 Formato Excel detectado - VENTAS (primera línea en blanco)");
    
    // Buscar la fila con headers (debería ser la segunda fila)
    let headerRowIndex = 1; // Empezar desde la segunda fila
    let headers = data[headerRowIndex];
    
    // Verificar si la segunda fila tiene headers
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      console.log("⚠️ Segunda fila vacía, buscando headers...");
      // Buscar la primera fila con datos
      for (let i = 1; i < Math.min(data.length, 5); i++) {
        if (data[i] && Array.isArray(data[i]) && data[i].length > 0) {
          headers = data[i];
          headerRowIndex = i;
          break;
        }
      }
    }
    
    console.log(`- Headers encontrados en fila ${headerRowIndex + 1}:`, headers);
    
    // Los datos empiezan después de los headers
    const dataRows = data.slice(headerRowIndex + 1);
    const dataFiltered = dataRows.filter(row => row && row[27] && !isNaN(parseFloat(String(row[27]))));
    console.log(`- Después de filtrar: ${dataFiltered.length} filas válidas`);
    
    return dataFiltered.slice(0, 20).map((row, index) => ({ // Limitar a 20 para debug
      id: `venta_${index}`,
      fechaEmision: new Date(),
      cliente: String(row[8] || 'Sin cliente'),
      total: parseFloat(String(row[27])),
      raw: row.slice(0, 5)
    }));
  } else {
    // Formato JSON
    console.log("📋 Formato JSON detectado");
    return data.slice(0, 20).map((item, index) => ({
      id: `venta_${index}`,
      fechaEmision: new Date(),
      cliente: String(item.cliente || 'Sin cliente'),
      total: parseFloat(String(item.total || 0)),
      raw: item
    }));
  }
}

function normalizarComprasConDebug(data: any[]) {
  console.log("🔍 Normalizando compras - debug:");
  
  if (!Array.isArray(data)) {
    console.error("❌ Compras no es array:", typeof data);
    return [];
  }
  
  console.log(`- Array recibido con ${data.length} elementos`);
  console.log(`- Primer elemento:`, data[0]);
  console.log(`- Segundo elemento:`, data[1]);
  console.log(`- Es array de arrays?:`, Array.isArray(data[0]));
  
  if (Array.isArray(data[0])) {
    // Formato Excel - COMPRAS tienen primera línea en blanco
    console.log("📋 Formato Excel detectado - COMPRAS (primera línea en blanco)");
    
    // Buscar la fila con headers (debería ser la segunda fila)
    let headerRowIndex = 1; // Empezar desde la segunda fila
    let headers = data[headerRowIndex];
    
    // Verificar si la segunda fila tiene headers
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      console.log("⚠️ Segunda fila vacía, buscando headers...");
      // Buscar la primera fila con datos
      for (let i = 1; i < Math.min(data.length, 5); i++) {
        if (data[i] && Array.isArray(data[i]) && data[i].length > 0) {
          headers = data[i];
          headerRowIndex = i;
          break;
        }
      }
    }
    
    console.log(`- Headers encontrados en fila ${headerRowIndex + 1}:`, headers);
    
    // Los datos empiezan después de los headers
    const dataRows = data.slice(headerRowIndex + 1);
    const dataFiltered = dataRows.filter(row => row && row[29] && !isNaN(parseFloat(String(row[29]))));
    console.log(`- Después de filtrar: ${dataFiltered.length} filas válidas`);
    
    return dataFiltered.slice(0, 20).map((row, index) => ({ // Limitar a 20 para debug
      id: `compra_${index}`,
      fechaEmision: new Date(),
      proveedor: String(row[8] || 'Sin proveedor'),
      total: parseFloat(String(row[29])),
      raw: row.slice(0, 5)
    }));
  }
  
  return [];
}

function normalizarExtractoConDebug(data: any[]) {
  console.log("🔍 Normalizando extracto - debug:");
  
  if (!Array.isArray(data)) {
    console.error("❌ Extracto no es array:", typeof data);
    return [];
  }
  
  console.log(`- Array recibido con ${data.length} elementos`);
  console.log(`- Primer elemento:`, data[0]);
  console.log(`- Es array de arrays?:`, Array.isArray(data[0]));
  
  if (Array.isArray(data[0])) {
    // Formato Excel - EXTRACTO tiene headers en primera línea
    console.log("📋 Formato Excel detectado - EXTRACTO (headers en primera línea)");
    
    // Headers en la primera fila, datos desde la segunda
    const headers = data[0];
    const dataRows = data.slice(1);
    
    console.log(`- Headers:`, headers);
    console.log(`- Datos desde fila 2: ${dataRows.length} filas`);
    
    const dataFiltered = dataRows.filter(row => row && row[2] && !isNaN(parseFloat(String(row[2]))));
    console.log(`- Después de filtrar: ${dataFiltered.length} filas válidas`);
    
    return dataFiltered.map((row, index) => {
      const importe = parseFloat(String(row[2]));
      return {
        id: `banco_${index}`,
        fechaOperacion: new Date(),
        concepto: String(row[1] || ''),
        importe: importe,
        tipo: importe > 0 ? 'ingreso' : 'egreso',
        raw: row.slice(0, 5)
      };
    });
  }
  
  return [];
}

// Helper para parsear archivos
async function parseFileToArray(file: File): Promise<any[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'csv') {
    const Papa = await import('papaparse');
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,  // ✅ Saltar líneas vacías
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error("❌ Errores en CSV:", results.errors);
            reject(new Error('Error al parsear CSV'));
          } else {
            const data = results.data as any[][];
            // Filtrar filas vacías
            const filteredData = data.filter(row => 
              row.some(cell => cell !== null && cell !== undefined && cell !== '')
            );
            
            console.log("📊 CSV parseado:", {
              totalRows: filteredData.length,
              primeraFila: filteredData[0],
              segundaFila: filteredData[1],
              terceraFila: filteredData[2]
            });
            
            resolve(filteredData);
          }
        },
        error: (error) => reject(error)
      });
    });
  } else if (extension === 'xlsx' || extension === 'xls') {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.worksheets[0];
    const rows: any[][] = [];
    
    worksheet.eachRow((row, rowNumber) => {
      const rowData: any[] = [];
      let hasData = false;
      
      row.eachCell((cell, colNumber) => {
        const value = cell.value;
        rowData[colNumber - 1] = value;
        if (value !== null && value !== undefined && value !== '') {
          hasData = true;
        }
      });
      
      // Solo agregar filas que tengan datos
      if (hasData) {
        rows.push(rowData);
      }
    });
    
    console.log("📊 Excel parseado:", {
      totalRows: rows.length,
      primeraFila: rows[0],
      segundaFila: rows[1],
      terceraFila: rows[2]
    });
    
    return rows;
  } else {
    throw new Error(`Formato de archivo no soportado: ${extension}`);
  }
}


