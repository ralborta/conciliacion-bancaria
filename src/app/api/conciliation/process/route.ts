import { NextRequest, NextResponse } from 'next/server'
import { ConciliationEngine } from '@/lib/engine/matcher'
import { memoryStorage } from '@/lib/storage/memory'
import { ProcessOptions, ConciliationStats } from '@/lib/types/conciliacion'
import { ArgentinaExcelParser } from '@/lib/parsers/excelParser'
import { AsientosGenerator } from '@/lib/engine/asientosGenerator'

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
    const procesamiento = await procesarConciliacionConDebug(ventasFile, comprasFile, extractoFile, banco, periodo);
    
    // Extraer datos del resultado (manejar tanto array como objeto)
    const resultado = Array.isArray(procesamiento) ? procesamiento : procesamiento.resultados;
    const ventasNormalizadas = Array.isArray(procesamiento) ? [] : procesamiento.ventasNormalizadas;
    const comprasNormalizadas = Array.isArray(procesamiento) ? [] : procesamiento.comprasNormalizadas;
    const impuestosNormalizados = Array.isArray(procesamiento) ? [] : procesamiento.impuestosNormalizados;
    const extractoNormalizado = Array.isArray(procesamiento) ? [] : procesamiento.extractoNormalizado;
    
    console.log("✅ Procesamiento completo:", {
      totalResultados: resultado.length || 0,
      tiposResultados: resultado?.map?.(r => r.status) || 'No array',
      ventas: ventasNormalizadas.length,
      compras: comprasNormalizadas.length,
      extracto: extractoNormalizado.length
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
    
    // IMPORTANTE: Estructura de respuesta esperada por el frontend
    const totalMovimientos = stats.totalMovimientos || 0;
    const totalCompras = comprasNormalizadas.length;
    const totalVentas = ventasNormalizadas.length;
    const totalImpuestos = impuestosNormalizados.length;
    const conciliados = stats.conciliados || 0;
    const pendientes = stats.pendientes || 0;
    
    // 🚨 GENERAR ASIENTOS CONTABLES - AGREGAR ESTAS LÍNEAS:
    console.log('🔍 Generando asientos contables...');
    console.log('🔍 Impuestos encontrados:', impuestosNormalizados?.length || 0);
    
    // 🔍 DEBUGGING ESTRUCTURA DE IMPUESTOS:
    console.log('🔍 DEBUGGING ESTRUCTURA DE IMPUESTOS:');
    console.log('🔍 Total impuestos:', impuestosNormalizados?.length || 0);

    if (impuestosNormalizados && impuestosNormalizados.length > 0) {
      // Mostrar los primeros 3 impuestos completos
      console.log('🔍 Primeros 3 impuestos (estructura completa):');
      impuestosNormalizados.slice(0, 3).forEach((imp, index) => {
        console.log(`Impuesto ${index + 1}:`, JSON.stringify(imp, null, 2));
      });
      
      // Mostrar todas las propiedades únicas
      const todasLasPropiedades = new Set();
      impuestosNormalizados.forEach(imp => {
        Object.keys(imp || {}).forEach(key => todasLasPropiedades.add(key));
      });
      console.log('🔍 Propiedades disponibles en impuestos:', Array.from(todasLasPropiedades));
      
      // Mostrar todos los conceptos únicos
      const conceptos = impuestosNormalizados.map(i => {
        return i.proveedor || i.tipo || 'Sin concepto';
      });
      const conceptosUnicos = [...new Set(conceptos)];
      console.log('🔍 Conceptos únicos encontrados:', conceptosUnicos);
      
      // Mostrar rangos de importes
      const importes = impuestosNormalizados.map(i => i.total || 0);
      const importeMin = Math.min(...importes);
      const importeMax = Math.max(...importes);
      console.log('🔍 Rango de importes:', { min: importeMin, max: importeMax });
    }

    let asientos: any[] = [];
    let resumen = {
      totalAsientos: 0,
      totalDebe: 0,
      totalHaber: 0,
      diferencia: 0,
      balanceado: true,
      asientosPorTipo: {}
    };

    console.log('🚨🚨🚨 DEBUGGING ASIENTOS - INICIO 🚨🚨🚨');
    console.log('impuestosNormalizados:', impuestosNormalizados?.length || 0);
    console.log('banco:', banco);
    console.log('periodo:', periodo);
    
    try {
      if (impuestosNormalizados && impuestosNormalizados.length > 0) {
        console.log('🎯 LLAMANDO AL GENERADOR DE ASIENTOS...');
        const resultado = AsientosGenerator.generateAsientosContables(impuestosNormalizados, banco, periodo);
        asientos = resultado.asientos;
        resumen = resultado.resumen;
        console.log('✅ Asientos generados:', asientos.length);
        console.log('✅ Primeros 3 asientos:', asientos.slice(0, 3));
      } else {
        console.log('⚠️ No hay impuestos para generar asientos');
        console.log('⚠️ impuestosNormalizados es null?', impuestosNormalizados === null);
        console.log('⚠️ impuestosNormalizados es undefined?', impuestosNormalizados === undefined);
        console.log('⚠️ impuestosNormalizados.length:', impuestosNormalizados?.length);
      }
    } catch (error) {
      console.error('❌ Error generando asientos:', error);
    }
    
    console.log('🚨🚨🚨 DEBUGGING ASIENTOS - FIN 🚨🚨🚨');
    
    console.log('📊 DATOS FINALES PARA ENVIAR:');
    console.log(`- Compras: ${totalCompras}`);
    console.log(`- Ventas: ${totalVentas}`);
    console.log(`- Impuestos: ${totalImpuestos}`);
    console.log(`- Extracto: ${totalMovimientos}`);
    console.log(`- Conciliados: ${conciliados}`);
    console.log(`- Pendientes: ${pendientes}`);
    console.log(`- Asientos: ${asientos.length}`);
    
    const response = {
      success: true,
      sessionId,
      data: {  // El frontend espera 'data', no 'results'
        totalMovimientos,
        totalCompras,
        totalVentas,
        conciliados,
        pendientes,
        porcentajeConciliado: totalMovimientos > 0 ? (conciliados / totalMovimientos) * 100 : 0,
        montoTotal: stats.montoTotal || 0,
        
        // INCLUIR LOS MOVIMIENTOS REALES CON RESULTADOS DEL MATCHING
        movements: extractoNormalizado.slice(0, 50).map((mov, index) => {
          // Buscar el resultado del matching para este movimiento
          const matchResult = resultado?.find((r: any) => r.extractoItem.id === mov.id);
          
          return {
            id: `mov_${index}`,
            fecha: mov.fechaOperacion?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
            concepto: mov.concepto || `Movimiento ${index + 1}`,
            monto: mov.importe || 0,
            tipo: (mov.importe || 0) > 0 ? 'Crédito' : 'Débito',
            estado: matchResult ? (matchResult.status === 'matched' ? 'conciliado' : 'pending') : 'pending',
            reason: matchResult?.reason || 'Sin procesar',
            referencia: `REF-${index}`,
            banco: mov.banco || banco,
            cuenta: mov.cuenta || 'Cuenta Principal',
            // Información de matching para comparación
            matchingDetails: {
              matchedWith: matchResult?.matchedWith || null,
              tipoDocumento: (matchResult as any)?.tipo || null,
              score: matchResult?.score || 0,
              // Información del documento que se intentó matchear
              documentoInfo: matchResult?.matchedWith ? {
                fecha: matchResult.matchedWith.fechaEmision?.toISOString().split('T')[0] || 'N/A',
                monto: matchResult.matchedWith.total || 0,
                cliente: matchResult.matchedWith.cliente || matchResult.matchedWith.proveedor || 'N/A',
                numero: matchResult.matchedWith.numero || 'N/A'
              } : null
            }
          };
        }),
        
        // INCLUIR LAS COMPRAS REALES
        compras: comprasNormalizadas.slice(0, 20).map((c, i) => ({
          id: `compra_${i}`,
          fecha: c.fechaEmision?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          proveedor: c.proveedor || `Proveedor ${i + 1}`,
          total: c.total || 0,
          numero: c.numero || '',
          cuit: c.cuitProveedor || ''
        })),
        
        // INCLUIR LAS VENTAS REALES
        ventas: ventasNormalizadas.slice(0, 20).map((v, i) => ({
          id: `venta_${i}`,
          fecha: v.fechaEmision?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          cliente: v.cliente || `Cliente ${i + 1}`,
          total: v.total || 0,
          tipo: v.tipo || 'Venta',
          cuit: v.cuitCliente || ''
        })),
        
        // INCLUIR LOS IMPUESTOS REALES
        impuestos: impuestosNormalizados.slice(0, 20).map((imp, i) => ({
          id: `impuesto_${i}`,
          fecha: imp.fechaEmision?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          concepto: (imp as any).concepto || (imp as any).descripcion || (imp as any).proveedor || `Impuesto ${i + 1}`, // ← CONCEPTO ORIGINAL DEL EXTRACTO
          monto: imp.total || 0, // ← SOLO "MONTO"
          tipo: 'Impuesto', // ← SOLO "IMPUESTO"
          cuit: imp.cuitProveedor || ''
        })),
        
        // ✨ AGREGAR ASIENTOS CONTABLES
        asientosContables: asientos,
        asientosResumen: resumen,
        // 🔍 PARA DEBUG:
        debug: {
          impuestosCount: impuestosNormalizados?.length || 0,
          asientosCount: asientos.length
        }
      },
      stats: {
        totalMovimientos,
        totalCompras,
        totalVentas,
        totalImpuestos,
        conciliados,
        pendientes,
        montoTotal: stats.montoTotal || 0,
        porcentajeConciliacion: totalMovimientos > 0 ? (conciliados / totalMovimientos) * 100 : 0
      }
    }
    
    console.log("📤 Enviando respuesta final:", {
      success: true,
      totalMovimientos: response.data.totalMovimientos,
      movements: response.data.movements.length,
      compras: response.data.compras.length,
      ventas: response.data.ventas.length,
      impuestos: response.data.impuestos.length,
      conciliados: response.data.conciliados,
      pendientes: response.data.pendientes
    })
    
    console.log("✅ Enviando respuesta con", response.data.movements.length, "movimientos");
    
    return NextResponse.json(response, { headers: corsHeaders });
    
  } catch (error) {
    console.error("❌ ERROR EN API:", error);
    const errorObj = error as Error;
    console.error("Stack:", errorObj.stack);
    
    return NextResponse.json({ 
      success: false, 
      error: errorObj.message,
      data: {  // Incluir data vacío para evitar errores en frontend
        totalMovimientos: 0,
        conciliados: 0,
        pendientes: 0,
        porcentajeConciliado: 0,
        montoTotal: 0,
        movements: []
      }
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
    
    // Verificar que los archivos no estén vacíos
    if (ventasFile.size === 0) {
      console.error("❌ ARCHIVO VENTAS VACÍO");
      throw new Error("El archivo de ventas está vacío");
    }
    if (comprasFile.size === 0) {
      console.error("❌ ARCHIVO COMPRAS VACÍO");
      throw new Error("El archivo de compras está vacío");
    }
    if (extractoFile.size === 0) {
      console.error("❌ ARCHIVO EXTRACTO VACÍO");
      throw new Error("El archivo de extracto está vacío");
    }
    
    console.log("✅ Archivos no están vacíos, procediendo con parseo...");
    
    const engine = new ConciliationEngine();
    const options: ProcessOptions = { banco, periodo };
    
    // Parsear archivos con el nuevo parser AFIP
    console.log("🔄 Parseando archivos con parser AFIP...");
    
    const parser = new ArgentinaExcelParser();
    
    // Parsear con el nuevo parser
    const ventasBuffer = await ventasFile.arrayBuffer();
    const comprasBuffer = await comprasFile.arrayBuffer();
    const extractoBuffer = await extractoFile.arrayBuffer();
    
    const ventasData = parser.parseAFIPFile(ventasBuffer, 'ventas');
    const comprasData = parser.parseAFIPFile(comprasBuffer, 'compras');
    const extractoData = parser.parseBankStatement(extractoBuffer);
    
    console.log("✅ Archivos parseados con parser AFIP:", {
      ventas: ventasData?.length || 0,
      compras: comprasData?.length || 0,
      extracto: extractoData?.length || 0
    });
    
    // PASO 2: Los datos ya están normalizados por el parser AFIP
    console.log("PASO 2 - Datos ya normalizados por parser AFIP");
    
    // Convertir datos del parser a formato esperado por el motor
    const ventasNormalizadas = ventasData.map((v, index) => ({
      id: `venta_${index}`,
      fechaEmision: v.fecha,
      cliente: v.cliente,
      total: v.total,
      cuitCliente: v.cuitCliente,
      tipo: v.tipo,
      puntoVenta: v.puntoVenta,
      numero: v.numero,
      neto: v.neto,
      iva: v.iva,
      medioCobro: 'Efectivo', // Valor por defecto
      moneda: 'ARS' // Valor por defecto
    }));
    
    const comprasNormalizadas = comprasData.map((c, index) => ({
      id: `compra_${index}`,
      fechaEmision: c.fecha,
      proveedor: c.proveedor,
      total: c.total,
      cuitProveedor: c.cuitProveedor,
      tipo: c.tipo,
      puntoVenta: c.puntoVenta,
      numero: c.numero,
      neto: c.neto,
      iva: c.iva,
      medioPago: 'Efectivo', // Valor por defecto
      moneda: 'ARS', // Valor por defecto
      formaPago: 'Efectivo' // Valor por defecto
    }));

    // SEPARAR IMPUESTOS DE COMPRAS
    const impuestosCompras = comprasData
      .filter(c => c.iva && c.iva > 0) // Solo compras con IVA
      .map((c, index) => ({
        id: `impuesto_compra_${index}`,
        fechaEmision: c.fecha,
        proveedor: c.proveedor,
        total: c.iva, // El IVA es el total del impuesto
        cuitProveedor: c.cuitProveedor,
        tipo: 'Impuesto IVA',
        puntoVenta: c.puntoVenta,
        numero: c.numero,
        neto: 0, // Los impuestos no tienen neto
        iva: 0, // Los impuestos no tienen IVA
        medioPago: 'Efectivo',
        moneda: 'ARS',
        formaPago: 'Efectivo'
      }));

    // SEPARAR IMPUESTOS DEL EXTRACTO BANCARIO
    const impuestosExtracto = extractoData
      .filter(e => {
        const concepto = e.concepto?.toLowerCase() || '';
        const esImpuesto = concepto.includes('impuesto') || 
                          concepto.includes('debito') || 
                          concepto.includes('ley 25413') ||
                          concepto.includes('retencion') ||
                          concepto.includes('comision') ||
                          concepto.includes('bip') ||
                          concepto.includes('transferencia') ||
                          concepto.includes('giro') ||
                          concepto.includes('daynet');
        return esImpuesto; // Solo incluir si ES impuesto/comisión/transferencia
      })
      .map((e, index) => ({
        id: `impuesto_extracto_${index}`,
        banco: banco,
        cuenta: 'Cuenta Principal',
        fechaOperacion: e.fecha,
        concepto: e.concepto,
        importe: e.importe,
        fechaValor: e.fechaValor || undefined,
        saldo: e.saldo
      }));

    // COMBINAR IMPUESTOS DE COMPRAS Y EXTRACTO
    const impuestosNormalizados = [
      ...impuestosCompras,
      ...impuestosExtracto.map(imp => ({
        id: imp.id,
        fechaEmision: imp.fechaOperacion,
        proveedor: 'Banco',
        concepto: imp.concepto, // ← PRESERVAR CONCEPTO ORIGINAL
        total: Math.abs(imp.importe), // Valor absoluto del importe
        cuitProveedor: '',
        tipo: 'Impuesto Bancario',
        puntoVenta: '',
        numero: '',
        neto: 0,
        iva: 0,
        medioPago: 'Efectivo',
        moneda: 'ARS',
        formaPago: 'Efectivo'
      }))
    ];

    const extractoNormalizado = extractoData
      .filter(e => {
        // FILTRAR IMPUESTOS DEL EXTRACTO BANCARIO
        const concepto = e.concepto?.toLowerCase() || '';
        const esImpuesto = concepto.includes('impuesto') || 
                          concepto.includes('debito') || 
                          concepto.includes('ley 25413') ||
                          concepto.includes('retencion') ||
                          concepto.includes('comision') ||
                          concepto.includes('bip') ||
                          concepto.includes('transferencia') ||
                          concepto.includes('giro') ||
                          concepto.includes('daynet');
        return !esImpuesto; // Solo incluir si NO es impuesto/comisión/transferencia
      })
      .map((e, index) => ({
        id: `banco_${index}`,
        banco: banco,
        cuenta: 'Cuenta Principal',
        fechaOperacion: e.fecha,
        concepto: e.concepto,
        importe: e.importe,
        fechaValor: e.fechaValor || undefined,
        saldo: e.saldo
      }));
    
    console.log("✅ Datos listos para matching:", {
      ventas: ventasNormalizadas.length,
      compras: comprasNormalizadas.length,
      impuestos: impuestosNormalizados.length,
      impuestosCompras: impuestosCompras.length,
      impuestosExtracto: impuestosExtracto.length,
      extracto: extractoNormalizado.length
    });

    // 🔍 DEBUG: Mostrar conceptos de impuestos del extracto
    console.log("🔍 CONCEPTOS DE IMPUESTOS DEL EXTRACTO:");
    impuestosExtracto.slice(0, 5).forEach((imp, index) => {
      console.log(`  ${index + 1}. "${imp.concepto}" - $${imp.importe}`);
    });
    
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
    
    // MOTOR ORIGINAL CON LÓGICA SIMPLE
    console.log("🚀 Iniciando motor original...");
    console.log("📊 Datos a procesar:", {
      ventas: ventasNormalizadas.length,
      compras: comprasNormalizadas.length,
      extracto: extractoNormalizado.length,
      muestraVentas: ventasNormalizadas.slice(0, 2),
      muestraCompras: comprasNormalizadas.slice(0, 2),
      muestraExtracto: extractoNormalizado.slice(0, 2)
    });
    
    try {
      // Usar el motor original que ya implementamos
      console.log("🔄 Llamando a engine.runMatching...");
      const resultados = await engine.runMatching(
        ventasNormalizadas,
        comprasNormalizadas, 
        extractoNormalizado
      );
      
      console.log("✅ Motor original completado:", {
        totalResultados: resultados.length,
        matchesExactos: resultados.filter(r => r.score >= 0.9).length,
        matchesParciales: resultados.filter(r => r.score < 0.9 && r.score > 0).length,
        sinMatch: resultados.filter(r => r.score === 0).length,
        muestraResultados: resultados.slice(0, 3)
      });
      
      return {
        resultados,
        ventasNormalizadas,
        comprasNormalizadas,
        impuestosNormalizados,
        extractoNormalizado
      };
      
    } catch (error) {
      console.error("❌ Error en motor original:", error);
      const errorObj = error as Error;
      
      // Fallback a matching básico si falla el motor original
      console.log("🔄 Fallback a matching básico...");
      const resultados = [];
      let matchesEncontrados = 0;
      
      console.log("🔄 Procesando ventas...");
      for (let i = 0; i < Math.min(ventasNormalizadas.length, 10); i++) {
        const venta = ventasNormalizadas[i];
        console.log(`  Venta ${i + 1}: $${venta.total} - ${venta.cliente || 'Sin cliente'}`);
        
        // Buscar ingreso bancario similar
        const match = extractoNormalizado.find(mov => 
          mov.importe > 0 && 
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
      return {
        resultados,
        ventasNormalizadas,
        comprasNormalizadas,
        impuestosNormalizados,
        extractoNormalizado
      };
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
  if (!Array.isArray(data)) {
    return [];
  }
  
  if (Array.isArray(data[0])) {
    // Formato Excel - VENTAS tienen primera línea en blanco
    // Buscar la fila con headers (debería ser la segunda fila)
    let headerRowIndex = 1; // Empezar desde la segunda fila
    let headers = data[headerRowIndex];
    
    // Verificar si la segunda fila tiene headers
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      // Buscar la primera fila con datos
      for (let i = 1; i < Math.min(data.length, 5); i++) {
        if (data[i] && Array.isArray(data[i]) && data[i].length > 0) {
          headers = data[i];
          headerRowIndex = i;
          break;
        }
      }
    }
    
    // Los datos empiezan después de los headers
    const dataRows = data.slice(headerRowIndex + 1);
    
    // 🔍 DEBUG: Verificar qué columnas tienen datos
    if (dataRows.length > 0) {
      console.log("🔍 VENTAS - Primera fila de datos:", dataRows[0]);
      console.log("🔍 VENTAS - Longitud de fila:", dataRows[0].length);
      console.log("🔍 VENTAS - Columna 8 (cliente):", dataRows[0][8]);
      console.log("🔍 VENTAS - Columna 27 (total):", dataRows[0][27]);
    }
    
    // Buscar la columna que tiene el total (puede ser diferente a la 27)
    let totalColumnIndex = 27; // Por defecto
    if (dataRows.length > 0) {
      // Buscar la columna con el número más alto (probablemente el total)
      for (let i = 0; i < dataRows[0].length; i++) {
        const value = dataRows[0][i];
        if (value && !isNaN(parseFloat(String(value))) && parseFloat(String(value)) > 1000) {
          totalColumnIndex = i;
          console.log(`🔍 VENTAS - Columna de total encontrada en índice ${i}:`, value);
          break;
        }
      }
    }
    
    const dataFiltered = dataRows.filter(row => row && row[totalColumnIndex] && !isNaN(parseFloat(String(row[totalColumnIndex]))));
    
    return dataFiltered.map((row, index) => ({
      id: `venta_${index}`,
      fechaEmision: new Date(),
      cliente: String(row[8] || 'Sin cliente'),
      total: parseFloat(String(row[totalColumnIndex])),
      raw: row.slice(0, 5)
    }));
  } else {
    // Formato JSON
    return data.map((item, index) => ({
      id: `venta_${index}`,
      fechaEmision: new Date(),
      cliente: String(item.cliente || 'Sin cliente'),
      total: parseFloat(String(item.total || 0)),
      raw: item
    }));
  }
}

function normalizarComprasConDebug(data: any[]) {
  if (!Array.isArray(data)) {
    return [];
  }
  
  if (Array.isArray(data[0])) {
    // Formato Excel - COMPRAS tienen primera línea en blanco
    // Buscar la fila con headers (debería ser la segunda fila)
    let headerRowIndex = 1; // Empezar desde la segunda fila
    let headers = data[headerRowIndex];
    
    // Verificar si la segunda fila tiene headers
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      // Buscar la primera fila con datos
      for (let i = 1; i < Math.min(data.length, 5); i++) {
        if (data[i] && Array.isArray(data[i]) && data[i].length > 0) {
          headers = data[i];
          headerRowIndex = i;
          break;
        }
      }
    }
    
    // Los datos empiezan después de los headers
    const dataRows = data.slice(headerRowIndex + 1);
    const dataFiltered = dataRows.filter(row => row && row[29] && !isNaN(parseFloat(String(row[29]))));
    
    return dataFiltered.map((row, index) => ({
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
  if (!Array.isArray(data)) {
    return [];
  }
  
  if (Array.isArray(data[0])) {
    // Formato Excel - EXTRACTO tiene headers en primera línea
    // Headers en la primera fila, datos desde la segunda
    const headers = data[0];
    const dataRows = data.slice(1);
    
    const dataFiltered = dataRows.filter(row => row && row[2] && !isNaN(parseFloat(String(row[2]))));
    
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
    
    // 🔍 DEBUG: Verificar todas las filas del Excel
    console.log(`📊 Excel - Total de filas en worksheet: ${worksheet.rowCount}`);
    
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
      
      // 🔍 DEBUG: Mostrar las primeras 5 filas
      if (rowNumber <= 5) {
        console.log(`📊 Excel - Fila ${rowNumber}:`, rowData);
      }
      
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


