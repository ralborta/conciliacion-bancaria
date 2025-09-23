// ============================================
// 1. NUEVA API MULTI-BANCO COMPLETA
// app/api/conciliation/multibank-complete/route.ts
// ============================================

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    console.log('🏦 Sistema Multi-Banco Completo - Iniciando')
    
    const formData = await req.formData()
    
    // Archivos base (ventas y compras)
    const ventasFile = formData.get('ventas') as File
    const comprasFile = formData.get('compras') as File
    const periodo = formData.get('periodo') as string
    
    // Obtener TODOS los extractos bancarios
    const extractos: { file: File; banco: string }[] = []
    let bancoIndex = 0
    
    // Recolectar todos los extractos subidos (máximo 10)
    while (bancoIndex < 10) {
      const extractoFile = formData.get(`extracto_${bancoIndex}`) as File
      const bancoName = formData.get(`banco_${bancoIndex}`) as string
      
      if (!extractoFile || !bancoName) break
      
      extractos.push({
        file: extractoFile,
        banco: bancoName
      })
      bancoIndex++
    }
    
    if (!ventasFile || !comprasFile || extractos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Faltan archivos requeridos'
      }, { status: 400 })
    }
    
    console.log('📊 Datos recibidos:', {
      ventas: ventasFile.name,
      compras: comprasFile.name,
      totalBancos: extractos.length,
      bancos: extractos.map(e => e.banco),
      periodo
    })
    
    // ========================================
    // PASO 1: Procesar el PRIMER banco
    // ========================================
    
    console.log('🔄 Procesando Banco 1/', extractos.length, ':', extractos[0].banco)
    
    const firstBankFormData = new FormData()
    firstBankFormData.append('ventas', ventasFile)
    firstBankFormData.append('compras', comprasFile)
    firstBankFormData.append('extracto', extractos[0].file)
    firstBankFormData.append('banco', extractos[0].banco)
    firstBankFormData.append('periodo', periodo)
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const firstResponse = await fetch(`${apiUrl}/api/conciliation/process`, {
      method: 'POST',
      body: firstBankFormData
    })
    
    if (!firstResponse.ok) {
      throw new Error(`Error procesando primer banco: ${firstResponse.statusText}`)
    }
    
    let currentResult = await firstResponse.json()
    
    if (!currentResult.success) {
      throw new Error(currentResult.error || 'Error en el primer banco')
    }
    
    // Guardar datos del primer banco
    let consolidatedResult = {
      ...currentResult.data,
      bankSteps: [{
        banco: extractos[0].banco,
        orden: 1,
        processedAt: new Date().toISOString(),
        conciliadosEnEsteBanco: currentResult.data.conciliados || 0,
        pendientesRestantes: currentResult.data.pendientes || 0,
        ventasConciliadas: currentResult.data.ventasConciliadas || 0,
        comprasConciliadas: currentResult.data.comprasConciliadas || 0
      }]
    }
    
    console.log('✅ Banco 1 completado:', {
      banco: extractos[0].banco,
      conciliados: consolidatedResult.conciliados,
      pendientes: consolidatedResult.pendientes
    })
    
    // ========================================
    // PASO 2: Procesar RESTO de bancos secuencialmente
    // ========================================
    
    for (let i = 1; i < extractos.length; i++) {
      const extractoActual = extractos[i]
      
      console.log(`🔄 Procesando Banco ${i + 1}/${extractos.length}: ${extractoActual.banco}`)
      console.log(`   Pendientes antes: ${consolidatedResult.pendientes}`)
      
      // Si no hay más pendientes, marcar como omitido
      if (consolidatedResult.pendientes === 0) {
        console.log('   ⏩ Omitiendo - No hay pendientes')
        consolidatedResult.bankSteps.push({
          banco: extractoActual.banco,
          orden: i + 1,
          processedAt: new Date().toISOString(),
          conciliadosEnEsteBanco: 0,
          pendientesRestantes: 0,
          omitido: true,
          razon: 'No había transacciones pendientes'
        })
        continue
      }
      
      // Obtener transacciones pendientes
      const transaccionesPendientes = getUnmatchedTransactions(consolidatedResult)
      
      if (transaccionesPendientes.ventas.length === 0 && transaccionesPendientes.compras.length === 0) {
        console.log('   ⏩ Omitiendo - No se pudieron extraer pendientes')
        consolidatedResult.bankSteps.push({
          banco: extractoActual.banco,
          orden: i + 1,
          processedAt: new Date().toISOString(),
          conciliadosEnEsteBanco: 0,
          pendientesRestantes: consolidatedResult.pendientes,
          omitido: true,
          razon: 'No se pudieron identificar transacciones pendientes'
        })
        continue
      }
      
      // Crear CSVs de pendientes
      const ventasPendientesCsv = createCSVFromTransactions(transaccionesPendientes.ventas, 'ventas')
      const comprasPendientesCsv = createCSVFromTransactions(transaccionesPendientes.compras, 'compras')
      
      const ventasPendientesFile = new File([ventasPendientesCsv], 'ventas_pendientes.csv', { type: 'text/csv' })
      const comprasPendientesFile = new File([comprasPendientesCsv], 'compras_pendientes.csv', { type: 'text/csv' })
      
      console.log(`   Pendientes a procesar: ${transaccionesPendientes.ventas.length} ventas, ${transaccionesPendientes.compras.length} compras`)
      
      // Procesar con el motor de conciliación
      const nextBankFormData = new FormData()
      nextBankFormData.append('ventas', ventasPendientesFile)
      nextBankFormData.append('compras', comprasPendientesFile)
      nextBankFormData.append('extracto', extractoActual.file)
      nextBankFormData.append('banco', extractoActual.banco)
      nextBankFormData.append('periodo', periodo)
      
      const nextResponse = await fetch(`${apiUrl}/api/conciliation/process`, {
        method: 'POST',
        body: nextBankFormData
      })
      
      if (!nextResponse.ok) {
        console.error(`❌ Error procesando banco ${i + 1}:`, nextResponse.statusText)
        // No fallar todo, continuar con el siguiente
        consolidatedResult.bankSteps.push({
          banco: extractoActual.banco,
          orden: i + 1,
          processedAt: new Date().toISOString(),
          error: true,
          errorMessage: nextResponse.statusText
        })
        continue
      }
      
      const nextResult = await nextResponse.json()
      
      if (!nextResult.success) {
        console.error(`❌ Error en resultado del banco ${i + 1}:`, nextResult.error)
        consolidatedResult.bankSteps.push({
          banco: extractoActual.banco,
          orden: i + 1,
          processedAt: new Date().toISOString(),
          error: true,
          errorMessage: nextResult.error
        })
        continue
      }
      
      // Consolidar resultados
      const nuevasConciliadas = nextResult.data.conciliados || 0
      
      consolidatedResult = {
        ...consolidatedResult,
        conciliados: consolidatedResult.conciliados + nuevasConciliadas,
        pendientes: Math.max(0, consolidatedResult.pendientes - nuevasConciliadas),
        movements: mergeMovements(consolidatedResult.movements, nextResult.data.movements, extractoActual.banco),
        asientos: [...(consolidatedResult.asientos || []), ...(nextResult.data.asientos || [])]
      }
      
      // Agregar info del banco procesado
      consolidatedResult.bankSteps.push({
        banco: extractoActual.banco,
        orden: i + 1,
        processedAt: new Date().toISOString(),
        conciliadosEnEsteBanco: nuevasConciliadas,
        pendientesRestantes: consolidatedResult.pendientes,
        ventasConciliadas: nextResult.data.ventasConciliadas || 0,
        comprasConciliadas: nextResult.data.comprasConciliadas || 0
      })
      
      console.log(`✅ Banco ${i + 1} completado:`, {
        banco: extractoActual.banco,
        nuevasConciliadas,
        totalConciliadas: consolidatedResult.conciliados,
        pendientesRestantes: consolidatedResult.pendientes
      })
    }
    
    // ========================================
    // PASO 3: Preparar resultado final
    // ========================================
    
    // Recalcular porcentaje final
    consolidatedResult.porcentajeConciliado = consolidatedResult.totalMovimientos > 0
      ? Math.round((consolidatedResult.conciliados / consolidatedResult.totalMovimientos) * 100 * 100) / 100
      : 0
    
    // Agregar metadata multi-banco
    consolidatedResult.isMultiBank = true
    consolidatedResult.totalBancos = extractos.length
    consolidatedResult.bancosProcesados = extractos.map(e => e.banco)
    
    // Generar resumen ejecutivo
    consolidatedResult.resumenEjecutivo = {
      totalTransacciones: consolidatedResult.totalMovimientos,
      totalConciliadas: consolidatedResult.conciliados,
      totalPendientes: consolidatedResult.pendientes,
      porcentajeConciliado: consolidatedResult.porcentajeConciliado,
      bancosProcesados: extractos.length,
      mejorBanco: getBestBank(consolidatedResult.bankSteps),
      distribucionPorBanco: consolidatedResult.bankSteps.map(step => ({
        banco: step.banco,
        conciliadas: step.conciliadosEnEsteBanco,
        porcentaje: consolidatedResult.totalMovimientos > 0 
          ? Math.round((step.conciliadosEnEsteBanco / consolidatedResult.totalMovimientos) * 100 * 100) / 100
          : 0
      }))
    }
    
    console.log('🎯 PROCESAMIENTO COMPLETO:', {
      totalBancos: extractos.length,
      totalConciliadas: consolidatedResult.conciliados,
      totalPendientes: consolidatedResult.pendientes,
      porcentaje: consolidatedResult.porcentajeConciliado + '%'
    })
    
    return NextResponse.json({
      success: true,
      data: consolidatedResult,
      sessionId: `multibank_complete_${Date.now()}`
    })
    
  } catch (error) {
    console.error('❌ Error en sistema multi-banco:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}

// ============================================
// FUNCIONES HELPER
// ============================================

function getUnmatchedTransactions(result: any) {
  const ventasPendientes = []
  const comprasPendientes = []
  
  // Opción 1: Si tenemos los arrays originales de ventas/compras
  if (result.ventas && result.compras) {
    result.ventas.forEach((venta: any) => {
      const conciliada = result.movements?.find((mov: any) =>
        mov.tipo === 'venta' &&
        mov.numero === venta.numero &&
        (mov.estado === 'conciliado' || mov.estado === 'matched')
      )
      if (!conciliada) {
        ventasPendientes.push(venta)
      }
    })
    
    result.compras.forEach((compra: any) => {
      const conciliada = result.movements?.find((mov: any) =>
        mov.tipo === 'compra' &&
        mov.numero === compra.numero &&
        (mov.estado === 'conciliado' || mov.estado === 'matched')
      )
      if (!conciliada) {
        comprasPendientes.push(compra)
      }
    })
  }
  // Opción 2: Reconstruir desde movements
  else if (result.movements) {
    result.movements.forEach((mov: any) => {
      if (mov.estado === 'pending' || mov.estado === 'sin conciliar' || mov.estado === 'no_matched') {
        if (mov.tipo === 'venta') {
          ventasPendientes.push({
            fecha: mov.fecha,
            cliente: mov.cliente || mov.descripcion,
            total: mov.monto || mov.total,
            numero: mov.numero
          })
        } else if (mov.tipo === 'compra') {
          comprasPendientes.push({
            fecha: mov.fecha,
            proveedor: mov.proveedor || mov.descripcion,
            total: mov.monto || mov.total,
            numero: mov.numero
          })
        }
      }
    })
  }
  
  return { ventas: ventasPendientes, compras: comprasPendientes }
}

function createCSVFromTransactions(transactions: any[], type: 'ventas' | 'compras'): string {
  if (!transactions || transactions.length === 0) {
    return type === 'ventas'
      ? 'fecha,cliente,total,numero\n'
      : 'fecha,proveedor,total,numero\n'
  }
  
  const headers = type === 'ventas'
    ? ['fecha', 'cliente', 'total', 'numero']
    : ['fecha', 'proveedor', 'total', 'numero']
  
  const rows = transactions.map(t => {
    if (type === 'ventas') {
      return [
        formatDate(t.fecha),
        cleanCSVValue(t.cliente || t.razonSocial || ''),
        formatNumber(t.total || t.monto || 0),
        cleanCSVValue(t.numero || t.numeroFactura || '')
      ].join(',')
    } else {
      return [
        formatDate(t.fecha),
        cleanCSVValue(t.proveedor || t.razonSocial || ''),
        formatNumber(t.total || t.monto || 0),
        cleanCSVValue(t.numero || t.numeroFactura || '')
      ].join(',')
    }
  })
  
  return [headers.join(','), ...rows].join('\n')
}

function mergeMovements(current: any[], newMovs: any[], banco: string): any[] {
  if (!current) return newMovs || []
  if (!newMovs) return current
  
  const merged = [...current]
  
  newMovs.forEach(newMov => {
    if (newMov.estado === 'conciliado' || newMov.estado === 'matched') {
      const index = merged.findIndex(m =>
        m.tipo === newMov.tipo && m.numero === newMov.numero
      )
      if (index >= 0) {
        merged[index] = {
          ...merged[index],
          estado: 'conciliado',
          conciliadoConBanco: banco,
          matchDetails: newMov.matchDetails
        }
      }
    }
  })
  
  return merged
}

function getBestBank(bankSteps: any[]): string {
  if (!bankSteps || bankSteps.length === 0) return ''
  const best = bankSteps.reduce((prev, current) => 
    (current.conciliadosEnEsteBanco > prev.conciliadosEnEsteBanco) ? current : prev
  )
  return best.banco
}

function formatDate(date: any): string {
  if (!date) return ''
  if (typeof date === 'string') return date
  if (date instanceof Date) return date.toISOString().split('T')[0]
  return String(date)
}

function cleanCSVValue(str: string): string {
  if (!str) return ''
  const cleaned = String(str).trim()
  return cleaned.includes(',') ? `"${cleaned}"` : cleaned
}

function formatNumber(num: any): string {
  return (parseFloat(num) || 0).toFixed(2)
}
