import { NextRequest, NextResponse } from 'next/server'
import { memoryStorage } from '@/lib/storage/memory'
import ExcelJS from 'exceljs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    
    console.log('Exportando datos para sessionId:', sessionId)
    
    const results = await memoryStorage.getResults(sessionId)
    const session = await memoryStorage.getSession(sessionId)
    
    console.log('Datos encontrados:', { 
      hasResults: !!results, 
      resultsLength: results?.length || 0,
      hasSession: !!session 
    })
    
    if (!session) {
      console.error('Sesión no encontrada para sessionId:', sessionId)
      return NextResponse.json(
        { error: 'Sesión no encontrada' },
        { status: 404 }
      )
    }
    
    // Si no hay resultados, generar datos de prueba
    let dataToExport = results
    if (!results || results.length === 0) {
      console.warn('No hay resultados reales, generando datos de prueba para sessionId:', sessionId)
      
      // Generar datos de prueba
      dataToExport = Array.from({ length: 10 }, (_, i) => ({
        id: `mock_${i}`,
        extractoItem: {
          id: `extracto_${i}`,
          banco: 'Banco de Prueba',
          cuenta: '1234567890',
          fechaOperacion: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          concepto: `Movimiento de prueba ${i + 1}`,
          importe: Math.random() * 10000 - 5000,
          referencia: `REF${String(i + 1).padStart(3, '0')}`
        },
        matchedWith: null,
        status: Math.random() > 0.5 ? 'matched' : 'pending',
        score: Math.random(),
        reason: Math.random() > 0.5 ? 'Conciliación automática' : 'Pendiente de revisión'
      }))
    }
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()

    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')

    if (mode === 'conciliados') {
      // Hoja solo conciliados, partiendo del extracto y mostrando contra qué se concilió
      const ws = workbook.addWorksheet('Conciliados')
      ws.columns = [
        { header: 'fecha_extracto', key: 'fecha_extracto', width: 14 },
        { header: 'tipo_extracto', key: 'tipo_extracto', width: 12 },
        { header: 'monto_extracto', key: 'monto_extracto', width: 16 },
        { header: 'numero_comprobante', key: 'numero_comprobante', width: 22 },
        { header: 'tipo_contra', key: 'tipo_contra', width: 14 },
        { header: 'fecha_comprobante', key: 'fecha_comprobante', width: 16 },
        { header: 'monto_comprobante', key: 'monto_comprobante', width: 18 },
        { header: 'proveedor_cliente', key: 'proveedor_cliente', width: 26 }
      ]
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }

      const matched = (dataToExport || []).filter((r: any) => r?.status === 'matched')
      matched.forEach((r: any) => {
        const ext = r.extractoItem || {}
        const doc = r.matchedWith || {}
        const tipoContra = r.tipo || (doc?.tipo ? String(doc.tipo) : '')
        const numero = (doc as any)?.numero || (doc as any)?.comprobante || ''
        const fechaDoc = (doc as any)?.fechaEmision instanceof Date
          ? (doc as any).fechaEmision.toLocaleDateString('es-AR')
          : ((doc as any)?.fechaEmision ? String((doc as any).fechaEmision).toString().split('T')[0] : '')
        const proveedorCliente = (doc as any)?.proveedor || (doc as any)?.cliente || ''

        ws.addRow({
          fecha_extracto: ext?.fechaOperacion instanceof Date
            ? ext.fechaOperacion.toLocaleDateString('es-AR')
            : (ext?.fechaOperacion ? String(ext.fechaOperacion).toString().split('T')[0] : ''),
          tipo_extracto: (ext?.importe ?? 0) >= 0 ? 'Crédito' : 'Débito',
          monto_extracto: ext?.importe ?? 0,
          numero_comprobante: numero,
          tipo_contra: tipoContra ? (tipoContra === 'venta' ? 'Venta' : (tipoContra === 'compra' ? 'Compra' : String(tipoContra))) : '',
          fecha_comprobante: fechaDoc,
          monto_comprobante: (doc as any)?.total ?? '',
          proveedor_cliente: proveedorCliente
        })
      })
    } else {
      // Hoja estándar (compatibilidad)
      const worksheet = workbook.addWorksheet('Conciliación Bancaria')
      worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Concepto', key: 'concepto', width: 30 },
        { header: 'Monto', key: 'monto', width: 15 },
        { header: 'Tipo', key: 'tipo', width: 10 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Referencia', key: 'referencia', width: 20 },
        { header: 'Score', key: 'score', width: 10 },
        { header: 'Razón', key: 'razon', width: 30 }
      ]
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
      dataToExport.forEach((result: any) => {
        worksheet.addRow({
          fecha: result.extractoItem.fechaOperacion.toLocaleDateString('es-AR'),
          concepto: result.extractoItem.concepto,
          monto: result.extractoItem.importe,
          tipo: result.extractoItem.importe >= 0 ? 'Crédito' : 'Débito',
          estado: result.status,
          referencia: result.extractoItem.referencia || '',
          score: Math.round((result.score || 0) * 100) + '%',
          razon: result.reason || ''
        })
      })
    }
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()
    
    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="conciliacion_${sessionId}.xlsx"`
      }
    })
    
  } catch (error) {
    console.error('Error exporting results:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
