// app/api/conciliation/multibank/route.ts - VERSIÓN CORREGIDA
import { NextRequest, NextResponse } from 'next/server'

// CORS headers para producción
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

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
      }, { status: 400, headers: corsHeaders })
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
      }, { status: 400, headers: corsHeaders })
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
      }, { headers: corsHeaders })
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
      }, { headers: corsHeaders })
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
    
    const apiUrl = getProductionApiUrl(req)
    
    const processUrl = new URL('/api/conciliation/process', req.url)
    const engineResponse = await fetch(processUrl.toString(), {
      method: 'POST',
      body: engineFormData,
      headers: {
        cookie: req.headers.get('cookie') || '',
        authorization: req.headers.get('authorization') || ''
      }
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
    // Consolidación preservando datos del primer banco
    const prevBankName = previousResults.banco || previousResults.currentBank
    const seededSteps = (previousResults.bankSteps && previousResults.bankSteps.length > 0)
      ? previousResults.bankSteps
      : [{
          banco: prevBankName,
          processedAt: previousResults.processedAt || new Date().toISOString(),
          matchedCount: previousResults.conciliados || 0,
          pendingCount: previousResults.pendientes || 0,
          totalVentas: previousResults.totalVentas || 0,
          totalCompras: previousResults.totalCompras || 0
        }]

    const consolidatedResult: any = {
      // Mantener datos originales
      ventas: previousResults.ventas,
      compras: previousResults.compras,
      
      // Actualizar totales
      totalMovimientos: previousResults.totalMovimientos,
      conciliados: previousResults.conciliados + (newResult.conciliados || 0),
      pendientes: Math.max(0, previousResults.pendientes - (newResult.conciliados || 0)),
      
      // Actualizar movements
      movements: updateMovements(previousResults.movements || [], newResult.movements || [], banco),
      
      // Otros datos (concatenar)
      impuestos: [
        ...(previousResults.impuestos || []),
        ...(newResult.impuestos || [])
      ],
      asientosContables: [
        ...((previousResults as any).asientosContables || previousResults.asientos || []),
        ...((newResult as any).asientosContables || newResult.asientos || [])
      ],
      asientosResumen: (newResult as any).asientosResumen || (previousResults as any).asientosResumen || {
        totalAsientos: 0, totalDebe: 0, totalHaber: 0, diferencia: 0, balanceado: true, asientosPorTipo: {}
      },
      
      // Info multi-banco
      isMultiBank: true,
      currentBank: banco,
      previousBank: prevBankName,
      bankSteps: [
        ...seededSteps,
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

    // Totales multibanco
    consolidatedResult.totalBancos = (consolidatedResult.bankSteps || []).length
    consolidatedResult.bancosProcesados = (consolidatedResult.bankSteps || []).map((s: any) => s.banco)

    console.log('🎯 Resultado consolidado:', {
      totalConciliados: consolidatedResult.conciliados,
      totalPendientes: consolidatedResult.pendientes,
      porcentaje: consolidatedResult.porcentajeConciliado,
      bancosProcesados: consolidatedResult.bankSteps.length,
      asientos: consolidatedResult.asientosContables?.length || 0,
      impuestos: consolidatedResult.impuestos?.length || 0
    })

    return NextResponse.json({
      success: true,
      data: consolidatedResult,
      sessionId: `multibank_${Date.now()}`
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('❌ Error en API multi-banco:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500, headers: corsHeaders })
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

// Helper: construir URL base de API según entorno (Vercel/Railway) con fallback por headers
function getProductionApiUrl(req: NextRequest): string {
  // Railway (algunas plantillas)
  if (process.env.RAILWAY_STATIC_URL) return process.env.RAILWAY_STATIC_URL
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  if (process.env.RAILWAY_URL) return process.env.RAILWAY_URL

  // Vercel (no incluye protocolo)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  // URL explícita de producción
  if (process.env.PRODUCTION_API_URL) return process.env.PRODUCTION_API_URL

  // Fallback a host de la request (mismo dominio)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`

  // Local/dev
  return process.env.NODE_ENV === 'production'
    ? 'https://conciliacion-bancaria-production.up.railway.app'
    : 'http://localhost:3000'
}