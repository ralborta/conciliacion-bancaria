import { NextRequest, NextResponse } from 'next/server'
import { memoryStorage } from '@/lib/storage/memory'
import ExcelJS from 'exceljs'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
    
    const results = await memoryStorage.getResults(sessionId)
    const session = await memoryStorage.getSession(sessionId)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada' },
        { status: 404 }
      )
    }
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Conciliación Bancaria')
    
    // Add headers
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
    
    // Style headers
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    }
    
    // Add data rows
    results.forEach(result => {
      worksheet.addRow({
        fecha: result.extractoItem.fechaOperacion.toLocaleDateString('es-AR'),
        concepto: result.extractoItem.concepto,
        monto: result.extractoItem.importe,
        tipo: result.extractoItem.importe >= 0 ? 'Crédito' : 'Débito',
        estado: result.status,
        referencia: result.extractoItem.referencia || '',
        score: Math.round(result.score * 100) + '%',
        razon: result.reason || ''
      })
    })
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.width) {
        column.width = Math.max(column.width, 10)
      }
    })
    
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
