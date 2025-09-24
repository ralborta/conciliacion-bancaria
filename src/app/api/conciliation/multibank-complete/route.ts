// app/api/conciliation/multibank-complete/route.ts
// VERSIÓN CORREGIDA - Sin errores de TypeScript

import { NextRequest, NextResponse } from 'next/server'

// Types
interface BankStep {
  banco: string
  orden: number
  processedAt: string
  conciliadosEnEsteBanco: number
  pendientesRestantes: number
  ventasConciliadas?: number
  comprasConciliadas?: number
  omitido?: boolean
  razon?: string
  error?: boolean
  errorMessage?: string
}

interface ConciliationResult {
  success: boolean
  data?: any
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    console.log('🏦 Sistema Multi-Banco Completo - Iniciando')
    
    const formData = await req.formData()
    
    // Archivos base
    const ventasFile = formData.get('ventas') as File | null
    const comprasFile = formData.get('compras') as File | null
    const periodo = formData.get('periodo') as string
    
    if (!ventasFile || !comprasFile) {
      return NextResponse.json({
        success: false,
        error: 'Faltan archivos de ventas o compras'
      }, { status: 400 })
    }
    
    // Recolectar todos los extractos
    const extractos: { file: File; banco: string }[] = []
    
    for (let i = 0; i < 10; i++) {
      const extractoFile = formData.get(`extracto_${i}`) as File | null
      const bancoName = formData.get(`banco_${i}`) as string | null
      
      if (!extractoFile || !bancoName) break
      
      extractos.push({
        file: extractoFile,
        banco: bancoName
      })
    }
    
    if (extractos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere al menos un extracto bancario'
      }, { status: 400 })
    }
    
    console.log('📊 Archivos recibidos:', {
      ventas: ventasFile.name,
      compras: comprasFile.name,
      totalBancos: extractos.length,
      bancos: extractos.map(e => e.banco),
      periodo
    })
    
    // ========================================
    // PROCESAR PRIMER BANCO
    // ========================================
    
    console.log(`🔄 Procesando Banco 1/${extractos.length}: ${extractos[0].banco}`)
    
    const firstFormData = new FormData()
    firstFormData.append('ventas', ventasFile)
    firstFormData.append('compras', comprasFile)
    firstFormData.append('extracto', extractos[0].file)
    firstFormData.append('banco', extractos[0].banco)
    firstFormData.append('periodo', periodo)
    
    // Determinar URL de API
    const apiUrl = process.env.NODE_ENV === 'production'
      ? 'https://conciliacion-bancaria-production.up.railway.app'
      : 'http://localhost:3000'
    
    console.log('🚀 Llamando a motor de conciliación:', `${apiUrl}/api/conciliation/process`)
    
    const firstResponse = await fetch(`${apiUrl}/api/conciliation/process`, {
      method: 'POST',
      body: firstFormData
    })
    
    if (!firstResponse.ok) {
      const errorText = await firstResponse.text()
      console.error('❌ Error en primer banco:', errorText)
      throw new Error(`Error procesando primer banco: ${firstResponse.status}`)
    }
    
    const firstResult: ConciliationResult = await firstResponse.json()
    
    if (!firstResult.success || !firstResult.data) {
      throw new Error(firstResult.error || 'Error procesando el primer banco')
    }
    
    // Inicializar resultado consolidado
    let consolidatedResult = {
      ...firstResult.data,
      // Asegurar que tenemos las propiedades necesarias
      ventas: firstResult.data.ventas || [],
      compras: firstResult.data.compras || [],
      movements: firstResult.data.movements || [],
      conciliados: firstResult.data.conciliados || 0,
      pendientes: firstResult.data.pendientes || 0,
      totalMovimientos: firstResult.data.totalMovimientos || 0,
      bankSteps: [{
        banco: extractos[0].banco,
        orden: 1,
        processedAt: new Date().toISOString(),
        conciliadosEnEsteBanco: firstResult.data.conciliados || 0,
        pendientesRestantes: firstResult.data.pendientes || 0,
        ventasConciliadas: firstResult.data.ventasConciliadas || 0,
        comprasConciliadas: firstResult.data.comprasConciliadas || 0
      }] as BankStep[]
    }
    
    console.log('✅ Banco 1 procesado:', {
      banco: extractos[0].banco,
      conciliados: consolidatedResult.conciliados,
      pendientes: consolidatedResult.pendientes
    })
    
    // ========================================
    // PROCESAR BANCOS ADICIONALES
    // ========================================
    
    for (let i = 1; i < extractos.length; i++) {
      const extractoActual = extractos[i]
      
      console.log(`🔄 Procesando Banco ${i + 1}/${extractos.length}: ${extractoActual.banco}`)
      console.log(`   Pendientes a procesar: ${consolidatedResult.pendientes}`)
      
      // Si no hay pendientes, omitir
      if (consolidatedResult.pendientes === 0) {
        console.log('   ⏩ Sin pendientes - Omitiendo banco')
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
      
      // Filtrar transacciones pendientes
      const pendientesData = filtrarPendientes(consolidatedResult)
      
      if (pendientesData.ventas.length === 0 && pendientesData.compras.length === 0) {
        console.log('   ⚠️ No se pudieron extraer pendientes')
        consolidatedResult.bankSteps.push({
          banco: extractoActual.banco,
          orden: i + 1,
          processedAt: new Date().toISOString(),
          conciliadosEnEsteBanco: 0,
          pendientesRestantes: consolidatedResult.pendientes,
          omitido: true,
          razon: 'No se identificaron transacciones pendientes'
        })
        continue
      }
      
      console.log(`   📋 Pendientes encontrados: ${pendientesData.ventas.length} ventas, ${pendientesData.compras.length} compras`)
      
      // Crear archivos CSV de pendientes
      const ventasCsv = crearCSV(pendientesData.ventas, 'ventas')
      const comprasCsv = crearCSV(pendientesData.compras, 'compras')
      
      const ventasPendFile = new File([ventasCsv], 'ventas_pend.csv', { type: 'text/csv' })
      const comprasPendFile = new File([comprasCsv], 'compras_pend.csv', { type: 'text/csv' })
      
      // Procesar con el motor
      const nextFormData = new FormData()
      nextFormData.append('ventas', ventasPendFile)
      nextFormData.append('compras', comprasPendFile)
      nextFormData.append('extracto', extractoActual.file)
      nextFormData.append('banco', extractoActual.banco)
      nextFormData.append('periodo', periodo)
      
      try {
        const nextResponse = await fetch(`${apiUrl}/api/conciliation/process`, {
          method: 'POST',
          body: nextFormData
        })
        
        if (!nextResponse.ok) {
          console.error(`❌ Error HTTP en banco ${i + 1}:`, nextResponse.status)
          consolidatedResult.bankSteps.push({
            banco: extractoActual.banco,
            orden: i + 1,
            processedAt: new Date().toISOString(),
            conciliadosEnEsteBanco: 0,
            pendientesRestantes: consolidatedResult.pendientes,
            error: true,
            errorMessage: `Error HTTP: ${nextResponse.status}`
          })
          continue
        }
        
        const nextResult: ConciliationResult = await nextResponse.json()
        
        if (!nextResult.success || !nextResult.data) {
          console.error(`❌ Error en resultado banco ${i + 1}`)
          consolidatedResult.bankSteps.push({
            banco: extractoActual.banco,
            orden: i + 1,
            processedAt: new Date().toISOString(),
            conciliadosEnEsteBanco: 0,
            pendientesRestantes: consolidatedResult.pendientes,
            error: true,
            errorMessage: nextResult.error || 'Error desconocido'
          })
          continue
        }
        
        // Actualizar resultado consolidado
        const nuevasConciliadas = nextResult.data.conciliados || 0
        
        consolidatedResult.conciliados += nuevasConciliadas
        consolidatedResult.pendientes = Math.max(0, consolidatedResult.pendientes - nuevasConciliadas)
        
        // Actualizar movements
        if (nextResult.data.movements) {
          consolidatedResult.movements = actualizarMovements(
            consolidatedResult.movements,
            nextResult.data.movements,
            extractoActual.banco
          )
        }
        
        // Agregar asientos
        if (nextResult.data.asientos) {
          consolidatedResult.asientos = [
            ...(consolidatedResult.asientos || []),
            ...nextResult.data.asientos
          ]
        }
        
        // Registrar paso
        consolidatedResult.bankSteps.push({
          banco: extractoActual.banco,
          orden: i + 1,
          processedAt: new Date().toISOString(),
          conciliadosEnEsteBanco: nuevasConciliadas,
          pendientesRestantes: consolidatedResult.pendientes,
          ventasConciliadas: nextResult.data.ventasConciliadas || 0,
          comprasConciliadas: nextResult.data.comprasConciliadas || 0
        })
        
        console.log(`✅ Banco ${i + 1} procesado:`, {
          banco: extractoActual.banco,
          nuevasConciliadas,
          totalConciliadas: consolidatedResult.conciliados,
          pendientesRestantes: consolidatedResult.pendientes
        })
        
      } catch (error) {
        console.error(`❌ Error procesando banco ${i + 1}:`, error)
        consolidatedResult.bankSteps.push({
          banco: extractoActual.banco,
          orden: i + 1,
          processedAt: new Date().toISOString(),
          conciliadosEnEsteBanco: 0,
          pendientesRestantes: consolidatedResult.pendientes,
          error: true,
          errorMessage: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }
    
    // ========================================
    // PREPARAR RESULTADO FINAL
    // ========================================
    
    // Calcular porcentaje final
    consolidatedResult.porcentajeConciliado = consolidatedResult.totalMovimientos > 0
      ? Math.round((consolidatedResult.conciliados / consolidatedResult.totalMovimientos) * 100)
      : 0
    
    // Metadata multi-banco
    consolidatedResult.isMultiBank = true
    consolidatedResult.totalBancos = extractos.length
    consolidatedResult.bancosProcesados = extractos.map(e => e.banco)
    
    // Resumen ejecutivo
    consolidatedResult.resumenEjecutivo = {
      totalTransacciones: consolidatedResult.totalMovimientos,
      totalConciliadas: consolidatedResult.conciliados,
      totalPendientes: consolidatedResult.pendientes,
      porcentajeConciliado: consolidatedResult.porcentajeConciliado,
      bancosProcesados: extractos.length,
      mejorBanco: obtenerMejorBanco(consolidatedResult.bankSteps),
      distribucionPorBanco: consolidatedResult.bankSteps.map((step: BankStep) => ({
        banco: step.banco,
        conciliadas: step.conciliadosEnEsteBanco,
        porcentaje: consolidatedResult.totalMovimientos > 0 
          ? Math.round((step.conciliadosEnEsteBanco / consolidatedResult.totalMovimientos) * 100)
          : 0
      }))
    }
    
    console.log('🎯 PROCESAMIENTO COMPLETADO:', {
      totalBancos: extractos.length,
      totalConciliadas: consolidatedResult.conciliados,
      totalPendientes: consolidatedResult.pendientes,
      porcentaje: `${consolidatedResult.porcentajeConciliado}%`
    })
    
    return NextResponse.json({
      success: true,
      data: consolidatedResult,
      sessionId: `multibank_${Date.now()}`
    })
    
  } catch (error) {
    console.error('❌ Error general:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}

// ========================================
// FUNCIONES AUXILIARES
// ========================================

function filtrarPendientes(result: any): { ventas: any[], compras: any[] } {
  const ventasPend: any[] = []
  const comprasPend: any[] = []
  
  // Usar arrays originales si existen
  if (result.ventas && result.compras && result.movements) {
    // Filtrar ventas no conciliadas
    result.ventas.forEach((venta: any) => {
      const estaConciliada = result.movements.some((mov: any) =>
        mov.tipo === 'venta' &&
        mov.numero === venta.numero &&
        (mov.estado === 'conciliado' || mov.estado === 'matched')
      )
      if (!estaConciliada) {
        ventasPend.push(venta)
      }
    })
    
    // Filtrar compras no conciliadas
    result.compras.forEach((compra: any) => {
      const estaConciliada = result.movements.some((mov: any) =>
        mov.tipo === 'compra' &&
        mov.numero === compra.numero &&
        (mov.estado === 'conciliado' || mov.estado === 'matched')
      )
      if (!estaConciliada) {
        comprasPend.push(compra)
      }
    })
  }
  // Fallback: reconstruir desde movements
  else if (result.movements) {
    result.movements.forEach((mov: any) => {
      if (mov.estado === 'pending' || mov.estado === 'sin conciliar') {
        if (mov.tipo === 'venta') {
          ventasPend.push({
            fecha: mov.fecha,
            cliente: mov.cliente || mov.descripcion,
            total: mov.monto || mov.total,
            numero: mov.numero
          })
        } else if (mov.tipo === 'compra') {
          comprasPend.push({
            fecha: mov.fecha,
            proveedor: mov.proveedor || mov.descripcion,
            total: mov.monto || mov.total,
            numero: mov.numero
          })
        }
      }
    })
  }
  
  return { ventas: ventasPend, compras: comprasPend }
}

function crearCSV(items: any[], tipo: 'ventas' | 'compras'): string {
  if (!items || items.length === 0) {
    return tipo === 'ventas'
      ? 'fecha,cliente,total,numero\n'
      : 'fecha,proveedor,total,numero\n'
  }
  
  const headers = tipo === 'ventas'
    ? ['fecha', 'cliente', 'total', 'numero']
    : ['fecha', 'proveedor', 'total', 'numero']
  
  const rows = items.map((item: any) => {
    if (tipo === 'ventas') {
      return [
        item.fecha || '',
        limpiarValor(item.cliente || item.razonSocial || ''),
        item.total || item.monto || '0',
        limpiarValor(item.numero || item.numeroFactura || '')
      ].join(',')
    } else {
      return [
        item.fecha || '',
        limpiarValor(item.proveedor || item.razonSocial || ''),
        item.total || item.monto || '0',
        limpiarValor(item.numero || item.numeroFactura || '')
      ].join(',')
    }
  })
  
  return [headers.join(','), ...rows].join('\n')
}

function actualizarMovements(current: any[], nuevos: any[], banco: string): any[] {
  if (!current) return nuevos || []
  if (!nuevos) return current
  
  const actualizado = [...current]
  
  nuevos.forEach((nuevo: any) => {
    if (nuevo.estado === 'conciliado' || nuevo.estado === 'matched') {
      const idx = actualizado.findIndex((m: any) =>
        m.tipo === nuevo.tipo && m.numero === nuevo.numero
      )
      if (idx >= 0) {
        actualizado[idx] = {
          ...actualizado[idx],
          estado: 'conciliado',
          conciliadoConBanco: banco
        }
      }
    }
  })
  
  return actualizado
}

function obtenerMejorBanco(steps: BankStep[]): string {
  if (!steps || steps.length === 0) return ''
  return steps.reduce((mejor, actual) => 
    actual.conciliadosEnEsteBanco > mejor.conciliadosEnEsteBanco ? actual : mejor
  ).banco
}

function limpiarValor(str: string): string {
  const val = String(str || '').trim()
  return val.includes(',') ? `"${val}"` : val
}