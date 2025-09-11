import { NextRequest, NextResponse } from 'next/server'
import { ConciliationEngine } from '@/lib/engine/matcher'
import { memoryStorage } from '@/lib/storage/memory'
import { ProcessOptions, ConciliationStats } from '@/lib/types/conciliacion'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const ventasFile = formData.get('ventas') as File
    const comprasFile = formData.get('compras') as File
    const extractoFile = formData.get('extracto') as File
    const banco = formData.get('banco') as string
    const periodo = formData.get('periodo') as string
    
    if (!ventasFile || !comprasFile || !extractoFile || !banco || !periodo) {
      return NextResponse.json(
        { error: 'Faltan archivos o parámetros requeridos' },
        { status: 400 }
      )
    }
    
    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
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
    
    // Process files with conciliation engine
    const engine = new ConciliationEngine()
    const options: ProcessOptions = { banco, periodo }
    
    const results = await engine.processFiles(
      ventasFile,
      comprasFile,
      extractoFile,
      options
    )
    
    // Calculate stats
    const stats: ConciliationStats = {
      totalMovimientos: results.length,
      conciliados: results.filter(r => r.status === 'matched').length,
      pendientes: results.filter(r => r.status === 'pending').length,
      montoTotal: results.reduce((sum, r) => sum + Math.abs(r.extractoItem.importe), 0),
      porcentajeConciliacion: results.length > 0 
        ? (results.filter(r => r.status === 'matched').length / results.length) * 100 
        : 0
    }
    
    // Save results and stats
    await memoryStorage.saveResults(sessionId, results)
    await memoryStorage.saveStats(sessionId, stats)
    await memoryStorage.saveSession(sessionId, {
      banco,
      periodo,
      createdAt: new Date(),
      status: 'completed'
    })
    
    return NextResponse.json({
      sessionId,
      results,
      stats,
      success: true
    })
    
  } catch (error) {
    console.error('Error processing conciliation:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
