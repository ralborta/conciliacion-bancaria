// app/api/conciliation/multibank/route.ts - NUEVO ENDPOINT
// Endpoint específico para procesar bancos adicionales

import { NextRequest, NextResponse } from 'next/server'
import { ConciliationEngine } from '@/lib/engine/matcher'
import { SmartVentasComprasParser } from '@/lib/parsers/smartVentasComprasParser'
import { SmartExtractoParser } from '@/lib/parsers/smartExtractoParser'

export async function POST(req: NextRequest) {
  try {
    console.log('🏦 API Multi-Banco - Iniciando proceso')
    
    const formData = await req.formData()
    
    // Datos del nuevo banco
    const extractoFile = formData.get('extracto') as File
    const banco = formData.get('banco') as string
    const periodo = formData.get('periodo') as string
    
    // Datos del banco anterior (JSON)
    const previousResultsJson = formData.get('previousResults') as string
    
    if (!extractoFile || !banco || !previousResultsJson) {
      return NextResponse.json({
        success: false,
        error: 'Faltan datos requeridos'
      })
    }

    console.log('📊 Datos recibidos:', {
      extracto: extractoFile.name,
      banco,
      previousResults: previousResultsJson ? 'SÍ' : 'NO'
    })

    // Parsear resultados del banco anterior
    const previousResults = JSON.parse(previousResultsJson)
    console.log('🔍 Resultados previos:', {
      conciliados: previousResults.conciliados,
      pendientes: previousResults.pendientes,
      movimientos: previousResults.movements?.length
    })

    // Extraer SOLO las transacciones NO conciliadas del resultado anterior
    const unmatchedTransactions = previousResults.movements?.filter((mov: any) => 
      mov.estado === 'pending' || mov.estado === 'sin conciliar'
    ) || []

    console.log('📋 Transacciones no conciliadas a procesar:', unmatchedTransactions.length)

    if (unmatchedTransactions.length === 0) {
      // No hay nada que conciliar
      return NextResponse.json({
        success: true,
        data: {
          ...previousResults,
          isMultiBank: true,
          noPendingTransactions: true,
          currentBank: banco,
          bankSteps: [
            ...(previousResults.bankSteps || []),
            {
              banco,
              processedAt: new Date().toISOString(),
              matchedCount: 0,
              pendingCount: 0,
              message: 'No había transacciones pendientes'
            }
          ]
        },
        sessionId: `multibank_${Date.now()}`
      })
    }

    // Convertir transacciones no conciliadas de vuelta a formato CSV
    const unmatchedVentas = unmatchedTransactions.filter((t: any) => t.tipo === 'venta')
    const unmatchedCompras = unmatchedTransactions.filter((t: any) => t.tipo === 'compra')

    // Crear archivos CSV temporales
    const ventasCsv = convertTransactionsToCSV(unmatchedVentas, 'ventas')
    const comprasCsv = convertTransactionsToCSV(unmatchedCompras, 'compras')
    
    const ventasFile = new File([ventasCsv], 'ventas_pendientes.csv', { type: 'text/csv' })
    const comprasFile = new File([comprasCsv], 'compras_pendientes.csv', { type: 'text/csv' })

    console.log('📄 Archivos creados:', {
      ventas: unmatchedVentas.length,
      compras: unmatchedCompras.length
    })

    // Usar el motor de conciliación existente (SIN TOCAR)
    const engine = new ConciliationEngine()
    
    // Parsear archivos con el parser inteligente
    const ventasComprasParser = new SmartVentasComprasParser()
    const extractoParser = new SmartExtractoParser()
    
    const ventasBuffer = await ventasFile.arrayBuffer()
    const comprasBuffer = await comprasFile.arrayBuffer()
    const extractoBuffer = await extractoFile.arrayBuffer()
    
    const ventasData = ventasComprasParser.parseVentas(ventasBuffer)
    const comprasData = ventasComprasParser.parseCompras(comprasBuffer)
    const extractoData = extractoParser.parseExtracto(extractoBuffer)
    
    // Normalizar datos
    const ventasNormalizadas = engine.normalizeVentas(ventasData)
    const comprasNormalizadas = engine.normalizeCompras(comprasData)
    const extractoNormalizado = engine.normalizeExtracto(extractoData)
    
    // Ejecutar matching
    const newResult = await engine.runMatching(
      ventasNormalizadas,
      comprasNormalizadas,
      extractoNormalizado
    )

    console.log('✅ Resultado de conciliación:', {
      conciliados: newResult.conciliados,
      pendientes: newResult.pendientes
    })

    // CONSOLIDAR resultados del banco anterior + nuevo banco
    const consolidatedResult = {
      // Totales consolidados
      totalMovimientos: previousResults.totalMovimientos,
      conciliados: previousResults.conciliados + (newResult.conciliados || 0),
      pendientes: previousResults.pendientes - (newResult.conciliados || 0),
      porcentajeConciliado: 0, // Se calcula abajo
      
      // Movimientos actualizados
      movements: updateMovementsStatus(previousResults.movements, newResult.movements),
      
      // Mantener otros datos
      ventas: previousResults.ventas,
      compras: previousResults.compras,
      impuestos: previousResults.impuestos,
      asientos: [...(previousResults.asientos || []), ...(newResult.asientos || [])],
      
      // Info multi-banco
      isMultiBank: true,
      currentBank: banco,
      bankSteps: [
        ...(previousResults.bankSteps || []),
        {
          banco,
          processedAt: new Date().toISOString(),
          matchedCount: newResult.conciliados || 0,
          pendingCount: newResult.pendientes || 0,
          ventasConciliadas: newResult.ventasConciliadas || 0,
          totalVentas: unmatchedVentas.length,
          comprasConciliadas: newResult.comprasConciliadas || 0,
          totalCompras: unmatchedCompras.length
        }
      ]
    }

    // Calcular porcentaje consolidado
    consolidatedResult.porcentajeConciliado = consolidatedResult.totalMovimientos > 0 
      ? (consolidatedResult.conciliados / consolidatedResult.totalMovimientos) * 100 
      : 0

    console.log('🎯 Resultado consolidado:', {
      totalConciliados: consolidatedResult.conciliados,
      totalPendientes: consolidatedResult.pendientes,
      porcentaje: consolidatedResult.porcentajeConciliado
    })

    return NextResponse.json({
      success: true,
      data: consolidatedResult,
      sessionId: `multibank_${Date.now()}`
    })

  } catch (error) {
    console.error('❌ Error en API multi-banco:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    })
  }
}

// Helper: Convertir transacciones a CSV
function convertTransactionsToCSV(transactions: any[], type: 'ventas' | 'compras'): string {
  if (transactions.length === 0) {
    // Retornar CSV vacío con headers
    const headers = type === 'ventas' 
      ? 'fecha,cliente,total,numero'
      : 'fecha,proveedor,total,numero'
    return headers + '\n'
  }

  const headers = Object.keys(transactions[0])
  const csvRows = [
    headers.join(','),
    ...transactions.map(row => 
      headers.map(key => {
        const value = row[key]
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value
      }).join(',')
    )
  ]
  
  return csvRows.join('\n')
}

// Helper: Actualizar estado de movimientos
function updateMovementsStatus(previousMovements: any[], newMatches: any[]): any[] {
  if (!previousMovements || !newMatches) return previousMovements || []

  const updatedMovements = [...previousMovements]
  
  // Marcar como conciliadas las que coincidieron en este banco
  newMatches.forEach(match => {
    const index = updatedMovements.findIndex(mov => 
      mov.id === match.id || 
      (mov.fecha === match.fecha && Math.abs(mov.monto - match.monto) < 0.01)
    )
    
    if (index >= 0) {
      updatedMovements[index] = {
        ...updatedMovements[index],
        estado: 'conciliado',
        reason: `Conciliado con ${match.banco || 'banco adicional'}`
      }
    }
  })

  return updatedMovements
}
