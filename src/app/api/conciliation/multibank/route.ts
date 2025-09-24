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

    // Filtrar ventas pendientes (usar matchingDetails.documentoInfo.numero)
    previousResults.ventas.forEach((venta: any) => {
      let estaConciliada = false
      
      if (previousResults.movements) {
        estaConciliada = previousResults.movements.some((mov: any) => {
          if (!(mov.estado === 'conciliado' || mov.estado === 'matched')) return false
          const docNum = mov?.matchingDetails?.documentoInfo?.numero || mov?.numero
          return docNum && String(docNum) === String(venta.numero)
        })
      }
      
      if (!estaConciliada) {
        ventasPendientes.push(venta)
      }
    })

    // Filtrar compras pendientes (usar matchingDetails.documentoInfo.numero)
    previousResults.compras.forEach((compra: any) => {
      let estaConciliada = false
      
      if (previousResults.movements) {
        estaConciliada = previousResults.movements.some((mov: any) => {
          if (!(mov.estado === 'conciliado' || mov.estado === 'matched')) return false
          const docNum = mov?.matchingDetails?.documentoInfo?.numero || mov?.numero
          return docNum && String(docNum) === String(compra.numero)
        })
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
          ventasConciliadas: 0,
          comprasConciliadas: 0,
          totalVentas: (previousResults.ventas?.length) || previousResults.totalVentas || 0,
          totalCompras: (previousResults.compras?.length) || previousResults.totalCompras || 0
        }]

    const stepMatched = newResult.conciliados || 0
    const stepPendingGlobal = Math.max(0, (previousResults.pendientes || 0) - stepMatched)

    const consolidatedResult: any = {
      // Mantener datos originales
      ventas: previousResults.ventas,
      compras: previousResults.compras,
      
      // Actualizar totales
      totalMovimientos: (previousResults.totalMovimientos || 0) + (newResult.totalMovimientos || (newResult.movements?.length || 0)),
      conciliados: previousResults.conciliados + (newResult.conciliados || 0),
      pendientes: Math.max(0, previousResults.pendientes - (newResult.conciliados || 0)),
      
      // Actualizar movements
      movements: [
        ...updateMovements(previousResults.movements || [], newResult.movements || [], banco),
        ...normalizeNewMovements(newResult.movements || [], banco)
      ],
      
      // Otros datos (concatenar)
      impuestos: [
        ...(previousResults.impuestos || []),
        ...(newResult.impuestos || [])
      ],
      asientosContables: [
        ...((previousResults as any).asientosContables || previousResults.asientos || []),
        ...((newResult as any).asientosContables || newResult.asientos || [])
      ],
      asientosResumen: aggregateAsientosResumen(
        (previousResults as any).asientosResumen,
        (newResult as any).asientosResumen,
        ((previousResults as any).asientosContables || previousResults.asientos || []).length,
        ((newResult as any).asientosContables || newResult.asientos || []).length
      ),
      
      // Info multi-banco
      isMultiBank: true,
      currentBank: banco,
      previousBank: prevBankName,
      bankSteps: [
        ...seededSteps,
        {
          banco,
          processedAt: new Date().toISOString(),
          matchedCount: stepMatched,
          pendingCount: stepPendingGlobal,
          ventasConciliadas: (newResult.movements || []).filter((m: any) => (m.tipo === 'venta') && (m.estado === 'conciliado' || m.estado === 'matched')).length,
          comprasConciliadas: (newResult.movements || []).filter((m: any) => (m.tipo === 'compra') && (m.estado === 'conciliado' || m.estado === 'matched')).length,
          totalVentas: ventasPendientes.length + ((previousResults.ventas?.length || 0) - ventasPendientes.length),
          totalCompras: comprasPendientes.length + ((previousResults.compras?.length || 0) - comprasPendientes.length)
        }
      ]
    }

    // Calcular porcentaje
    consolidatedResult.porcentajeConciliado = consolidatedResult.totalMovimientos > 0 
      ? Math.round((consolidatedResult.conciliados / consolidatedResult.totalMovimientos) * 100)
      : 0

    // Totales multibanco
    consolidatedResult.totalBancos = (consolidatedResult.bankSteps || []).length
    consolidatedResult.bancosProcesados = (consolidatedResult.bankSteps || []).map((s: any, idx: number) => `Banco #${idx+1}: ${s.banco}`)

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

  const getNumero = (m: any) => m?.numero || m?.matchingDetails?.documentoInfo?.numero || m?.documentoInfo?.numero || null
  const getFecha = (m: any) => m?.fecha || m?.matchingDetails?.documentoInfo?.fecha || null
  const getMonto = (m: any) => m?.monto ?? m?.matchingDetails?.documentoInfo?.monto ?? null

  newMovements.forEach(newMov => {
    if (newMov.estado === 'conciliado' || newMov.estado === 'matched') {
      const newNum = getNumero(newMov)
      const newFecha = getFecha(newMov)
      const newMonto = getMonto(newMov)

      const index = updated.findIndex(mov => {
        if (mov.tipo !== newMov.tipo) return false
        const oldNum = getNumero(mov)
        if (oldNum && newNum) return oldNum === newNum

        // Fallback por fecha + monto (tolerancia centavos)
        const oldFecha = getFecha(mov)
        const oldMonto = getMonto(mov)
        const sameMonto = oldMonto !== null && newMonto !== null && Math.abs(Number(oldMonto) - Number(newMonto)) < 0.01
        const sameFecha = !!oldFecha && !!newFecha && String(oldFecha) === String(newFecha)
        return sameMonto && sameFecha
      })

      if (index >= 0) {
        updated[index] = {
          ...updated[index],
          estado: 'conciliado',
          conciliadoConBanco: banco,
          matchingDetails: newMov.matchingDetails || updated[index].matchingDetails,
          // Enriquecer con detalle/identificadores si vienen en el nuevo movimiento
          concepto: newMov.concepto || updated[index].concepto,
          referencia: newMov.referencia || updated[index].referencia,
          banco: updated[index].banco || newMov.banco || banco,
          cuenta: updated[index].cuenta || newMov.cuenta || updated[index].cuenta,
          // Mantener número si viene del nuevo movimiento (más confiable)
          numero: getNumero(newMov) || updated[index].numero,
          fecha: getFecha(newMov) || updated[index].fecha,
          monto: (newMov.monto ?? updated[index].monto)
        }
      }
    }
  })

  return updated
}

// Normalizar movimientos nuevos que no existían en previous (para que muestren concepto/estado)
function normalizeNewMovements(newMovements: any[], banco: string) {
  return (newMovements || []).filter(Boolean).map((m: any, idx: number) => ({
    id: m.id || `new_${idx}`,
    fecha: m.fecha || m.matchingDetails?.documentoInfo?.fecha || new Date().toISOString().split('T')[0],
    concepto: m.concepto || m.matchingDetails?.documentoInfo?.concepto || 'Movimiento',
    monto: m.monto ?? m.matchingDetails?.documentoInfo?.monto ?? 0,
    tipo: m.tipo || ((m.monto ?? 0) >= 0 ? 'Crédito' : 'Débito'),
    estado: m.estado || 'pending',
    reason: m.reason || undefined,
    referencia: m.referencia || m.matchingDetails?.documentoInfo?.numero || undefined,
    banco: m.banco || banco,
    cuenta: m.cuenta || 'Cuenta Principal',
    matchingDetails: m.matchingDetails || undefined
  }))
}

// Agregar/Acumular resumen de asientos contables
function aggregateAsientosResumen(prev: any, curr: any, prevCount: number, currCount: number) {
  const base = {
    totalAsientos: 0,
    totalDebe: 0,
    totalHaber: 0,
    diferencia: 0,
    balanceado: true,
    asientosPorTipo: {} as Record<string, number>
  }
  const a = prev || base
  const b = curr || base
  const sum = {
    totalAsientos: (a.totalAsientos || prevCount || 0) + (b.totalAsientos || currCount || 0),
    totalDebe: (a.totalDebe || 0) + (b.totalDebe || 0),
    totalHaber: (a.totalHaber || 0) + (b.totalHaber || 0)
  }
  const diferencia = (sum.totalDebe - sum.totalHaber)
  const balanceado = Math.abs(diferencia) < 0.01
  const tipos: Record<string, number> = { ...a.asientosPorTipo }
  for (const [k, v] of Object.entries(b.asientosPorTipo || {})) {
    tipos[k] = (tipos[k] || 0) + (v as number)
  }
  return { ...base, ...sum, diferencia, balanceado, asientosPorTipo: tipos }
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