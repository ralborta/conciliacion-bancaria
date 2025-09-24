// app/api/conciliation/multibank-simple/route.js
// VERSIÓN SIMPLE EN JAVASCRIPT - SIN ERRORES DE TYPES

import { NextResponse } from 'next/server'
import { memoryStorage } from '@/lib/storage/memory'

export async function POST(req) {
  try {
    console.log('🏦 Multi-Banco Simple - Iniciando')
    
    const formData = await req.formData()
    
    // Obtener archivos base
    const ventasFile = formData.get('ventas')
    const comprasFile = formData.get('compras')
    const periodo = formData.get('periodo') || 'Septiembre 2024'
    
    if (!ventasFile || !comprasFile) {
      console.error('❌ Faltan archivos base')
      return NextResponse.json({
        success: false,
        error: 'Faltan archivos de ventas o compras'
      })
    }
    
    // Recolectar extractos
    const extractos = []
    for (let i = 0; i < 10; i++) {
      const extracto = formData.get(`extracto_${i}`)
      const banco = formData.get(`banco_${i}`)
      
      if (!extracto || !banco) break
      
      extractos.push({ file: extracto, banco: banco })
    }
    
    if (extractos.length === 0) {
      console.error('❌ No hay extractos')
      return NextResponse.json({
        success: false,
        error: 'Se requiere al menos un extracto bancario'
      })
    }
    
    console.log('✅ Archivos recibidos:', {
      ventas: ventasFile.name,
      compras: comprasFile.name,
      bancos: extractos.map(e => e.banco)
    })
    
    // ========================================
    // PROCESAR PRIMER BANCO
    // ========================================
    
    console.log('🔄 Procesando Banco 1:', extractos[0].banco)
    
    const firstFormData = new FormData()
    firstFormData.append('ventas', ventasFile)
    firstFormData.append('compras', comprasFile)
    firstFormData.append('extracto', extractos[0].file)
    firstFormData.append('banco', extractos[0].banco)
    firstFormData.append('periodo', periodo)
    
    // URL del motor de conciliación (mismo origen si es posible)
    const apiUrl = getApiBaseUrl(req)
    
    let response = await fetch(`${apiUrl}/api/conciliation/process`, {
      method: 'POST',
      body: firstFormData
    })
    
    if (!response.ok) {
      console.error('❌ Error en primer banco:', response.status)
      return NextResponse.json({
        success: false,
        error: 'Error procesando primer banco'
      })
    }
    
    let result = await response.json()
    
    if (!result.success) {
      console.error('❌ Fallo primer banco:', result.error)
      return NextResponse.json({
        success: false,
        error: result.error || 'Error en primer banco'
      })
    }
    
    // Guardar resultado acumulado
    let consolidado = {
      ...result.data,
      bankSteps: [{
        banco: extractos[0].banco,
        conciliadas: result.data.conciliados || 0,
        pendientes: result.data.pendientes || 0
      }]
    }
    
    console.log('✅ Banco 1 completado:', {
      conciliadas: consolidado.conciliados,
      pendientes: consolidado.pendientes
    })
    
    // ========================================
    // PROCESAR RESTO DE BANCOS
    // ========================================
    
    for (let i = 1; i < extractos.length; i++) {
      const banco = extractos[i]
      
      console.log(`🔄 Procesando Banco ${i + 1}:`, banco.banco)
      
      // Si no hay pendientes, saltar
      if (consolidado.pendientes === 0) {
        console.log('   ⏩ Sin pendientes, omitiendo')
        consolidado.bankSteps.push({
          banco: banco.banco,
          conciliadas: 0,
          pendientes: 0,
          omitido: true
        })
        continue
      }
      
      // Obtener pendientes
      const pendientes = getPendientes(consolidado)
      
      if (pendientes.ventas.length === 0 && pendientes.compras.length === 0) {
        console.log('   ⚠️ No se encontraron pendientes')
        consolidado.bankSteps.push({
          banco: banco.banco,
          conciliadas: 0,
          pendientes: consolidado.pendientes,
          error: 'No se pudieron extraer pendientes'
        })
        continue
      }
      
      console.log(`   📋 Pendientes: ${pendientes.ventas.length} ventas, ${pendientes.compras.length} compras`)
      
      // Crear CSVs
      const ventasCsv = makeCSV(pendientes.ventas, 'ventas')
      const comprasCsv = makeCSV(pendientes.compras, 'compras')
      
      const ventasBlob = new Blob([ventasCsv], { type: 'text/csv' })
      const comprasBlob = new Blob([comprasCsv], { type: 'text/csv' })
      
      // Crear FormData
      const nextFormData = new FormData()
      nextFormData.append('ventas', ventasBlob, 'ventas.csv')
      nextFormData.append('compras', comprasBlob, 'compras.csv')
      nextFormData.append('extracto', banco.file)
      nextFormData.append('banco', banco.banco)
      nextFormData.append('periodo', periodo)
      
      // Procesar
      try {
        response = await fetch(`${apiUrl}/api/conciliation/process`, {
          method: 'POST',
          body: nextFormData
        })
        
        if (!response.ok) {
          console.error(`❌ Error en banco ${i + 1}:`, response.status)
          consolidado.bankSteps.push({
            banco: banco.banco,
            error: 'Error HTTP: ' + response.status
          })
          continue
        }
        
        result = await response.json()
        
        if (!result.success) {
          console.error(`❌ Fallo banco ${i + 1}:`, result.error)
          consolidado.bankSteps.push({
            banco: banco.banco,
            error: result.error
          })
          continue
        }
        
        // Actualizar consolidado
        const nuevas = result.data.conciliados || 0
        consolidado.conciliados += nuevas
        consolidado.pendientes = Math.max(0, consolidado.pendientes - nuevas)
        
        // Combinar movements
        if (result.data.movements && consolidado.movements) {
          consolidado.movements = mergeMovements(
            consolidado.movements, 
            result.data.movements,
            banco.banco
          )
        }
        
        // Combinar asientos
        if (result.data.asientos) {
          consolidado.asientos = [
            ...(consolidado.asientos || []),
            ...result.data.asientos
          ]
        }
        
        // Registrar paso
        consolidado.bankSteps.push({
          banco: banco.banco,
          conciliadas: nuevas,
          pendientes: consolidado.pendientes
        })
        
        console.log(`✅ Banco ${i + 1} completado:`, {
          nuevas,
          totalConciliadas: consolidado.conciliados
        })
        
      } catch (err) {
        console.error(`❌ Error banco ${i + 1}:`, err)
        consolidado.bankSteps.push({
          banco: banco.banco,
          error: err.message
        })
      }
    }
    
    // ========================================
    // RESULTADO FINAL
    // ========================================
    
    // Calcular porcentaje
    if (consolidado.totalMovimientos > 0) {
      consolidado.porcentajeConciliado = Math.round(
        (consolidado.conciliados / consolidado.totalMovimientos) * 100
      )
    }
    
    // Agregar info multi-banco
    consolidado.isMultiBank = true
    consolidado.totalBancos = extractos.length
    consolidado.bancosProcesados = extractos.map(e => e.banco)
    
    console.log('🎯 PROCESO COMPLETADO:', {
      bancos: extractos.length,
      conciliadas: consolidado.conciliados,
      pendientes: consolidado.pendientes,
      porcentaje: consolidado.porcentajeConciliado + '%'
    })
    
    // ========================================
    // PERSISTIR RESULTADO Y RESPONDER CON SESSIONID
    // ========================================
    const sessionId = `multibank_${Date.now()}`

    const stats = {
      totalMovimientos: consolidado.totalMovimientos || 0,
      conciliados: consolidado.conciliados || 0,
      pendientes: consolidado.pendientes || 0,
      montoTotal: (consolidado.movements || []).reduce((s, m) => s + Math.abs(m.monto || 0), 0),
      porcentajeConciliacion: consolidado.totalMovimientos > 0
        ? (consolidado.conciliados / consolidado.totalMovimientos) * 100
        : 0
    }

    try {
      await memoryStorage.saveResults(sessionId, consolidado)
      await memoryStorage.saveStats(sessionId, stats)
      await memoryStorage.saveSession(sessionId, {
        banco: consolidado.bancosProcesados?.[0] || 'MultiBanco',
        periodo,
        createdAt: new Date(),
        status: 'completed'
      })
      console.log('💾 Persistencia OK:', {
        sessionId,
        movements: consolidado.movements?.length || 0,
        ventas: consolidado.ventas?.length || 0,
        compras: consolidado.compras?.length || 0
      })
    } catch (persistErr) {
      console.error('❌ Error persistiendo resultados:', persistErr)
    }

    return NextResponse.json({
      success: true,
      data: consolidado,
      sessionId
    })
    
  } catch (error) {
    console.error('❌ Error general:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno'
    })
  }
}

// ========================================
// FUNCIONES HELPER SIMPLES
// ========================================

function getPendientes(data) {
  const ventas = []
  const compras = []
  
  // Opción 1: Desde arrays originales
  if (data.ventas && data.compras && data.movements) {
    data.ventas.forEach(v => {
      const conciliada = data.movements.find(m => 
        m.tipo === 'venta' && 
        m.numero === v.numero && 
        (m.estado === 'conciliado' || m.estado === 'matched')
      )
      if (!conciliada) ventas.push(v)
    })
    
    data.compras.forEach(c => {
      const conciliada = data.movements.find(m => 
        m.tipo === 'compra' && 
        m.numero === c.numero && 
        (m.estado === 'conciliado' || m.estado === 'matched')
      )
      if (!conciliada) compras.push(c)
    })
  }
  // Opción 2: Desde movements
  else if (data.movements) {
    data.movements.forEach(m => {
      if (m.estado === 'pending' || m.estado === 'sin conciliar') {
        if (m.tipo === 'venta') {
          ventas.push({
            fecha: m.fecha,
            cliente: m.cliente || m.descripcion,
            total: m.monto || m.total,
            numero: m.numero
          })
        } else if (m.tipo === 'compra') {
          compras.push({
            fecha: m.fecha,
            proveedor: m.proveedor || m.descripcion,
            total: m.monto || m.total,
            numero: m.numero
          })
        }
      }
    })
  }
  
  return { ventas, compras }
}

function makeCSV(items, tipo) {
  if (!items || items.length === 0) {
    return tipo === 'ventas'
      ? 'fecha,cliente,total,numero\n'
      : 'fecha,proveedor,total,numero\n'
  }
  
  let csv = tipo === 'ventas'
    ? 'fecha,cliente,total,numero\n'
    : 'fecha,proveedor,total,numero\n'
  
  items.forEach(item => {
    if (tipo === 'ventas') {
      csv += `${item.fecha || ''},${cleanValue(item.cliente || item.razonSocial || '')},${item.total || 0},${cleanValue(item.numero || '')}\n`
    } else {
      csv += `${item.fecha || ''},${cleanValue(item.proveedor || item.razonSocial || '')},${item.total || 0},${cleanValue(item.numero || '')}\n`
    }
  })
  
  return csv
}

function cleanValue(str) {
  const val = String(str || '').trim()
  return val.includes(',') ? `"${val}"` : val
}

function mergeMovements(current, newMovs, banco) {
  const merged = [...current]
  
  newMovs.forEach(nuevo => {
    if (nuevo.estado === 'conciliado' || nuevo.estado === 'matched') {
      const idx = merged.findIndex(m => 
        m.tipo === nuevo.tipo && m.numero === nuevo.numero
      )
      if (idx >= 0) {
        merged[idx].estado = 'conciliado'
        merged[idx].conciliadoConBanco = banco
      }
    }
  })
  
  return merged
}

// Helper: base URL del mismo origen si es posible (headers/env), fallback local
function getApiBaseUrl(req) {
  const headers = req.headers
  const host = headers.get('x-forwarded-host') || headers.get('host')
  const proto = headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  if (process.env.RAILWAY_STATIC_URL) return process.env.RAILWAY_STATIC_URL
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  if (process.env.RAILWAY_URL) return process.env.RAILWAY_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.PRODUCTION_API_URL) return process.env.PRODUCTION_API_URL
  return process.env.NODE_ENV === 'production'
    ? 'https://conciliacion-bancaria-production.up.railway.app'
    : 'http://localhost:3000'
}


