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
      tieneVentas: !!previousResults.ventas,
      tieneCompras: !!previousResults.compras,
      tieneMovements: !!previousResults.movements
    })

    // IMPORTANTE: Verificar que tenemos los datos necesarios
    if (!previousResults.ventas || !previousResults.compras) {
      console.error('❌ No hay datos de ventas/compras en resultados previos')
      return NextResponse.json({
        success: false,
        error: 'Los resultados previos no contienen ventas y compras originales'
      })
    }

    // Si no hay pendientes, retornar inmediatamente
    if (previousResults.pendientes === 0) {
      console.log('✅ No hay pendientes para procesar')
      return NextResponse.json({
        success: true,
        data: {
          ...previousResults,
          isMultiBank: true,
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

    // Filtrar las transacciones NO conciliadas
    const ventasPendientes: any[] = []
    const comprasPendientes: any[] = []

    // Filtrar ventas pendientes
    previousResults.ventas.forEach((venta: any) => {
      let estaConciliada = false
      
      if (previousResults.movements) {
        estaConciliada = previousResults.movements.some((mov: any) => 
          mov.tipo === 'venta' && 
          mov.numero === venta.numero && 
          (mov.estado === 'conciliado' || mov.estado === 'matched')
        )
      }
      
      if (!estaConciliada) {
        ventasPendientes.push(venta)
      }
    })

    // Filtrar compras pendientes  
    previousResults.compras.forEach((compra: any) => {
      let estaConciliada = false
      
      if (previousResults.movements) {
        estaConciliada = previousResults.movements.some((mov: any) => 
          mov.tipo === 'compra' && 
          mov.numero === compra.numero && 
          (mov.estado === 'conciliado' || mov.estado === 'matched')
        )
      }
      
      if (!estaConciliada) {
        comprasPendientes.push(compra)
      }
    })

    console.log('📋 Transacciones pendientes encontradas:', {
      ventasPendientes: ventasPendientes.length,
      comprasPendientes: comprasPendientes.length,
      totalPendientes: ventasPendientes.length + comprasPendientes.length
    })

    // Si no hay nada pendiente (verificación doble)
    if (ventasPendientes.length === 0 && comprasPendientes.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          ...previousResults,
          isMultiBank: true,
          currentBank: banco,
          bankSteps: [
            ...(previousResults.bankSteps || []),
            {
              banco,
              processedAt: new Date().toISOString(),
              matchedCount: 0,
              pendingCount: 0,
              message: 'No se encontraron transacciones pendientes específicas'
            }
          ]
        },
        sessionId: `multibank_${Date.now()}`
      })
    }

    // Crear CSV con las pendientes
    const ventasCSV = createCSVContent(ventasPendientes, 'ventas')
    const comprasCSV = createCSVContent(comprasPendientes, 'compras')
    
    console.log('📄 CSV Ventas (preview):', ventasCSV.substring(0, 200))
    console.log('📄 CSV Compras (preview):', comprasCSV.substring(0, 200))
    
    // Crear archivos File
    const ventasFile = new File([ventasCSV], 'ventas_pendientes.csv', { type: 'text/csv' })
    const comprasFile = new File([comprasCSV], 'compras_pendientes.csv', { type: 'text/csv' })

    // Crear FormData para el motor
    const engineFormData = new FormData()
    engineFormData.append('ventas', ventasFile)
    engineFormData.append('compras', comprasFile)
    engineFormData.append('extracto', extractoFile)
    engineFormData.append('banco', banco)
    engineFormData.append('periodo', periodo)
    
    // Llamar al motor de conciliación existente
    console.log('🚀 Llamando al motor de conciliación...')
    
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? 'https://conciliacion-bancaria-production.up.railway.app'
      : 'http://localhost:3000'
    
    const engineResponse = await fetch(`${apiUrl}/api/conciliation/process`, {
      method: 'POST',
      body: engineFormData
    })
    
    if (!engineResponse.ok) {
      const errorText = await engineResponse.text()
      console.error('❌ Error en motor:', errorText)
      throw new Error(`Error en motor: ${engineResponse.status}`)
    }
    
    const engineResult = await engineResponse.json()
    
    if (!engineResult.success) {
      throw new Error(engineResult.error || 'Error en el motor de conciliación')
    }
    
    const newResult = engineResult.data

    console.log('✅ Resultado del segundo banco:', {
      conciliados: newResult.conciliados,
      pendientes: newResult.pendientes
    })

    // CONSOLIDAR resultados
    const consolidatedResult = {
      // Mantener datos originales
      ventas: previousResults.ventas,
      compras: previousResults.compras,
      
      // Actualizar totales
      totalMovimientos: previousResults.totalMovimientos,
      conciliados: previousResults.conciliados + (newResult.conciliados || 0),
      pendientes: Math.max(0, previousResults.pendientes - (newResult.conciliados || 0)),
      
      // Actualizar movements
      movements: updateMovements(previousResults.movements || [], newResult.movements || [], banco),
      
      // Otros datos
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
          ventasProcesadas: ventasPendientes.length,
          comprasProcesadas: comprasPendientes.length
        }
      ]
    }

    // Calcular porcentaje
    consolidatedResult.porcentajeConciliado = consolidatedResult.totalMovimientos > 0 
      ? Math.round((consolidatedResult.conciliados / consolidatedResult.totalMovimientos) * 100)
      : 0

    console.log('🎯 Resultado consolidado:', {
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

// Función para crear CSV
function createCSVContent(items: any[], tipo: 'ventas' | 'compras'): string {
  if (!items || items.length === 0) {
    // Retornar CSV vacío pero válido
    return tipo === 'ventas' 
      ? 'fecha,cliente,total,numero\n'
      : 'fecha,proveedor,total,numero\n'
  }
  
  let csv = ''
  
  if (tipo === 'ventas') {
    csv = 'fecha,cliente,total,numero\n'
    items.forEach(item => {
      const fecha = item.fecha || ''
      const cliente = (item.cliente || item.razonSocial || '').toString().replace(/,/g, ';')
      const total = item.total || item.monto || '0'
      const numero = (item.numero || item.numeroFactura || '').toString().replace(/,/g, ';')
      csv += `${fecha},${cliente},${total},${numero}\n`
    })
  } else {
    csv = 'fecha,proveedor,total,numero\n'
    items.forEach(item => {
      const fecha = item.fecha || ''
      const proveedor = (item.proveedor || item.razonSocial || '').toString().replace(/,/g, ';')
      const total = item.total || item.monto || '0'
      const numero = (item.numero || item.numeroFactura || '').toString().replace(/,/g, ';')
      csv += `${fecha},${proveedor},${total},${numero}\n`
    })
  }
  
  return csv
}

// Función para actualizar movements
function updateMovements(previousMovements: any[], newMovements: any[], banco: string): any[] {
  const updated = [...previousMovements]
  
  newMovements.forEach(newMov => {
    if (newMov.estado === 'conciliado' || newMov.estado === 'matched') {
      const index = updated.findIndex(mov => 
        mov.tipo === newMov.tipo && 
        mov.numero === newMov.numero
      )
      
      if (index >= 0) {
        updated[index] = {
          ...updated[index],
          estado: 'conciliado',
          conciliadoConBanco: banco
        }
      }
    }
  })
  
  return updated
}