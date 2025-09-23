// app/api/conciliation/multibank/route.ts - VERSIÓN CORREGIDA
import { NextRequest, NextResponse } from 'next/server'

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
      periodo
    })

    // Parsear resultados del banco anterior
    const previousResults = JSON.parse(previousResultsJson)
    console.log('🔍 Resultados previos:', {
      conciliados: previousResults.conciliados,
      pendientes: previousResults.pendientes,
      movimientos: previousResults.movements?.length,
      ventas: previousResults.ventas?.length,
      compras: previousResults.compras?.length
    })

    // IMPORTANTE: Usar las ventas y compras ORIGINALES, no los movements
    // Los movements son el resultado de la conciliación, no los datos originales
    let ventasPendientes = []
    let comprasPendientes = []

    // Si tenemos los datos originales de ventas y compras
    if (previousResults.ventas && previousResults.compras) {
      // Filtrar las ventas no conciliadas
      ventasPendientes = previousResults.ventas.filter((venta: any) => {
        // Buscar si esta venta fue conciliada en los movements
        const conciliada = previousResults.movements?.find((mov: any) => 
          mov.tipo === 'venta' && 
          mov.numero === venta.numero && 
          (mov.estado === 'conciliado' || mov.estado === 'matched')
        )
        return !conciliada // Solo incluir si NO fue conciliada
      })

      // Filtrar las compras no conciliadas
      comprasPendientes = previousResults.compras.filter((compra: any) => {
        // Buscar si esta compra fue conciliada en los movements
        const conciliada = previousResults.movements?.find((mov: any) => 
          mov.tipo === 'compra' && 
          mov.numero === compra.numero && 
          (mov.estado === 'conciliado' || mov.estado === 'matched')
        )
        return !conciliada // Solo incluir si NO fue conciliada
      })
    } else {
      // Fallback: intentar reconstruir desde movements
      const movementsPendientes = previousResults.movements?.filter((mov: any) => 
        mov.estado === 'pending' || 
        mov.estado === 'sin conciliar' || 
        mov.estado === 'no_matched'
      ) || []

      ventasPendientes = movementsPendientes.filter((m: any) => m.tipo === 'venta')
      comprasPendientes = movementsPendientes.filter((m: any) => m.tipo === 'compra')
    }

    console.log('📋 Transacciones pendientes encontradas:', {
      ventasPendientes: ventasPendientes.length,
      comprasPendientes: comprasPendientes.length
    })

    if (ventasPendientes.length === 0 && comprasPendientes.length === 0) {
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
              message: 'No había transacciones pendientes para conciliar'
            }
          ]
        },
        sessionId: `multibank_${Date.now()}`
      })
    }

    // Convertir transacciones pendientes a formato CSV correcto
    const ventasCsv = convertVentasToCSV(ventasPendientes)
    const comprasCsv = convertComprasToCSV(comprasPendientes)
    
    // Debug: mostrar primeras líneas del CSV
    console.log('📄 CSV Ventas (primeras líneas):', ventasCsv.split('\n').slice(0, 3).join('\n'))
    console.log('📄 CSV Compras (primeras líneas):', comprasCsv.split('\n').slice(0, 3).join('\n'))
    
    const ventasFile = new File([ventasCsv], 'ventas_pendientes.csv', { type: 'text/csv' })
    const comprasFile = new File([comprasCsv], 'compras_pendientes.csv', { type: 'text/csv' })

    console.log('📄 Archivos CSV creados:', {
      ventas: {
        registros: ventasPendientes.length,
        tamaño: ventasFile.size
      },
      compras: {
        registros: comprasPendientes.length,
        tamaño: comprasFile.size
      }
    })

    // Crear FormData para usar la API existente
    const engineFormData = new FormData()
    engineFormData.append('ventas', ventasFile)
    engineFormData.append('compras', comprasFile)
    engineFormData.append('extracto', extractoFile)
    engineFormData.append('banco', banco)
    engineFormData.append('periodo', periodo)
    
    // Hacer llamada interna a la API que ya funciona
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    console.log('🚀 Llamando a API de conciliación:', `${apiUrl}/api/conciliation/process`)
    
    const engineResponse = await fetch(`${apiUrl}/api/conciliation/process`, {
      method: 'POST',
      body: engineFormData
    })
    
    if (!engineResponse.ok) {
      const errorText = await engineResponse.text()
      console.error('❌ Error en motor de conciliación:', errorText)
      throw new Error(`Error en motor de conciliación: ${engineResponse.statusText}`)
    }
    
    const engineResult = await engineResponse.json()
    
    if (!engineResult.success) {
      console.error('❌ Error en resultado del motor:', engineResult.error)
      throw new Error(engineResult.error || 'Error en el motor de conciliación')
    }
    
    const newResult = engineResult.data

    console.log('✅ Resultado de conciliación del segundo banco:', {
      conciliados: newResult.conciliados,
      pendientes: newResult.pendientes,
      movimientos: newResult.movements?.length
    })

    // CONSOLIDAR resultados
    const consolidatedResult = {
      // Totales consolidados
      totalMovimientos: previousResults.totalMovimientos,
      conciliados: previousResults.conciliados + (newResult.conciliados || 0),
      pendientes: Math.max(0, previousResults.pendientes - (newResult.conciliados || 0)),
      porcentajeConciliado: 0,
      
      // Mantener datos originales para próximas iteraciones
      ventas: previousResults.ventas,
      compras: previousResults.compras,
      
      // Actualizar movements combinando ambos resultados
      movements: mergeMovements(previousResults.movements, newResult.movements),
      
      // Datos adicionales
      impuestos: previousResults.impuestos,
      asientos: [...(previousResults.asientos || []), ...(newResult.asientos || [])],
      
      // Info multi-banco
      isMultiBank: true,
      currentBank: banco,
      previousBank: previousResults.banco,
      bankSteps: [
        ...(previousResults.bankSteps || [{
          banco: previousResults.banco,
          processedAt: previousResults.processedAt || new Date().toISOString(),
          matchedCount: previousResults.conciliados || 0,
          pendingCount: previousResults.pendientes || 0
        }]),
        {
          banco,
          processedAt: new Date().toISOString(),
          matchedCount: newResult.conciliados || 0,
          pendingCount: newResult.pendientes || 0,
          ventasConciliadas: newResult.ventasConciliadas || 0,
          comprasConciliadas: newResult.comprasConciliadas || 0
        }
      ]
    }

    // Calcular porcentaje consolidado
    consolidatedResult.porcentajeConciliado = consolidatedResult.totalMovimientos > 0 
      ? Math.round((consolidatedResult.conciliados / consolidatedResult.totalMovimientos) * 100 * 100) / 100
      : 0

    console.log('🎯 Resultado consolidado final:', {
      totalConciliados: consolidatedResult.conciliados,
      totalPendientes: consolidatedResult.pendientes,
      porcentaje: consolidatedResult.porcentajeConciliado,
      bancosProcesados: consolidatedResult.bankSteps.length
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
    }, { status: 500 })
  }
}

// Helper: Convertir ventas a CSV con formato correcto
function convertVentasToCSV(ventas: any[]): string {
  if (!ventas || ventas.length === 0) {
    return 'fecha,cliente,total,numero\n'
  }

  // Headers específicos para ventas
  const headers = ['fecha', 'cliente', 'total', 'numero']
  
  const csvRows = [
    headers.join(','),
    ...ventas.map(venta => {
      return [
        formatDate(venta.fecha),
        cleanString(venta.cliente || venta.razonSocial || ''),
        formatNumber(venta.total || venta.monto || 0),
        cleanString(venta.numero || venta.numeroFactura || '')
      ].join(',')
    })
  ]
  
  return csvRows.join('\n')
}

// Helper: Convertir compras a CSV con formato correcto
function convertComprasToCSV(compras: any[]): string {
  if (!compras || compras.length === 0) {
    return 'fecha,proveedor,total,numero\n'
  }

  // Headers específicos para compras
  const headers = ['fecha', 'proveedor', 'total', 'numero']
  
  const csvRows = [
    headers.join(','),
    ...compras.map(compra => {
      return [
        formatDate(compra.fecha),
        cleanString(compra.proveedor || compra.razonSocial || ''),
        formatNumber(compra.total || compra.monto || 0),
        cleanString(compra.numero || compra.numeroFactura || '')
      ].join(',')
    })
  ]
  
  return csvRows.join('\n')
}

// Helper: Combinar movements de ambas conciliaciones
function mergeMovements(previousMovements: any[], newMovements: any[]): any[] {
  if (!previousMovements) return newMovements || []
  if (!newMovements) return previousMovements
  
  const merged = [...previousMovements]
  
  // Actualizar los movements que se conciliaron en el segundo banco
  newMovements.forEach(newMov => {
    if (newMov.estado === 'conciliado' || newMov.estado === 'matched') {
      const index = merged.findIndex(prevMov => 
        prevMov.tipo === newMov.tipo &&
        prevMov.numero === newMov.numero
      )
      
      if (index >= 0) {
        // Actualizar el movement existente
        merged[index] = {
          ...merged[index],
          estado: 'conciliado',
          matchedBank: newMov.banco || 'Banco adicional',
          matchDetails: newMov.matchDetails
        }
      } else {
        // Agregar nuevo movement si no existía
        merged.push(newMov)
      }
    }
  })
  
  return merged
}

// Helpers de formato
function formatDate(date: any): string {
  if (!date) return ''
  if (typeof date === 'string') return date
  if (date instanceof Date) return date.toISOString().split('T')[0]
  return String(date)
}

function cleanString(str: string): string {
  if (!str) return ''
  // Si contiene comas, envolver en comillas
  const cleaned = String(str).trim()
  return cleaned.includes(',') ? `"${cleaned}"` : cleaned
}

function formatNumber(num: any): string {
  const n = parseFloat(num) || 0
  return n.toFixed(2)
}