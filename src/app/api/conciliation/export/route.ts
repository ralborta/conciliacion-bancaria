import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({})) as any
    const mode = payload?.mode || 'conciliados'
    const data = payload?.data || {}

    if (mode !== 'conciliados') {
      return NextResponse.json({ error: 'Modo no soportado' }, { status: 400 })
    }

    const workbook = new ExcelJS.Workbook()
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

    const movements: any[] = Array.isArray(data?.movements) ? data.movements : []
    const conciliados = movements.filter(m => m?.estado === 'conciliado' || m?.estado === 'matched')

    conciliados.forEach((m, idx) => {
      const md = m?.matchingDetails || {}
      const docInfo = md?.documentoInfo || {}
      const matchedWith = md?.matchedWith || {}
      const numero = docInfo?.numero || (matchedWith as any)?.numero || ''
      const fechaDoc = docInfo?.fecha || (matchedWith as any)?.fechaEmision || ''
      const proveedorCliente = docInfo?.cliente || docInfo?.proveedor || (matchedWith as any)?.cliente || (matchedWith as any)?.proveedor || ''
      const montoDoc = docInfo?.monto ?? (matchedWith as any)?.total ?? ''
      const tipoContra = (md as any)?.tipo || ''

      ws.addRow({
        fecha_extracto: m?.fecha || '',
        tipo_extracto: m?.tipo || ((m?.monto ?? 0) >= 0 ? 'Crédito' : 'Débito'),
        monto_extracto: m?.monto ?? 0,
        numero_comprobante: numero,
        tipo_contra: tipoContra ? (tipoContra === 'venta' ? 'Venta' : (tipoContra === 'compra' ? 'Compra' : String(tipoContra))) : '',
        fecha_comprobante: typeof fechaDoc === 'string' ? fechaDoc : (fechaDoc instanceof Date ? fechaDoc.toISOString().split('T')[0] : ''),
        monto_comprobante: montoDoc,
        proveedor_cliente: proveedorCliente
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="conciliados.xlsx"'
      }
    })
  } catch (err: any) {
    console.error('Error export POST:', err)
    return NextResponse.json({ error: 'Error exportando' }, { status: 500 })
  }
}


