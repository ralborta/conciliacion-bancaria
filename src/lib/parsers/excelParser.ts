// src/lib/parsers/excelParser.ts

import * as XLSX from 'xlsx';

export class ArgentinaExcelParser {
  
  parseAFIPFile(buffer: ArrayBuffer, type: 'ventas' | 'compras') {
    const workbook = XLSX.read(buffer, { 
      type: 'array',
      cellDates: true,
      raw: false,
      dateNF: 'dd/mm/yyyy'
    });
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: '',
      blankrows: true
    }) as any[][];  // Agregar tipo explícito
    
    console.log(`📊 ${type.toUpperCase()} - Estructura del archivo:`);
    
    // Validación segura
    if (!rawData || rawData.length < 2) {
      console.error('❌ Archivo vacío o sin suficientes filas');
      return [];
    }
    
    const firstRow = rawData[0];
    const secondRow = rawData[1];
    
    console.log(`  Fila 0:`, firstRow?.slice(0, 5) || 'vacía');
    console.log(`  Fila 1:`, secondRow?.slice(0, 5) || 'vacía');
    
    let headerRow: any[] = [];
    let dataStartRow = 2;
    
    // Verificación más segura
    const isFirstRowEmpty = !firstRow || firstRow.length === 0 || 
                            firstRow.every(cell => !cell || cell === '');
    
    const hasTitle = firstRow && firstRow[0] && 
                    typeof firstRow[0] === 'string' && 
                    firstRow[0].includes('Mis Comprobantes');
    
    if (isFirstRowEmpty || hasTitle) {
      // Headers en segunda fila
      headerRow = secondRow || [];
      dataStartRow = 2;
    } else {
      // Buscar headers dinámicamente
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const row = rawData[i];
        if (Array.isArray(row) && row.some(cell => 
          cell && typeof cell === 'string' && cell.toLowerCase() === 'fecha'
        )) {
          headerRow = row;
          dataStartRow = i + 1;
          break;
        }
      }
    }
    
    if (!headerRow || headerRow.length === 0) {
      console.error('❌ No se encontraron headers válidos');
      return [];
    }
    
    console.log(`✅ Headers encontrados:`, headerRow.filter(h => h).slice(0, 10));
    
    const dataRows = rawData.slice(dataStartRow);
    console.log(`✅ Filas de datos: ${dataRows.length}`);
    
    if (type === 'compras') {
      return this.parseCompras(headerRow, dataRows);
    } else {
      return this.parseVentas(headerRow, dataRows);
    }
  }
  
  private parseCompras(headers: any[], rows: any[]): any[] {
    // Mapeo de columnas
    const columnMap = {
      fecha: this.findColumnIndex(headers, ['fecha']),
      tipo: this.findColumnIndex(headers, ['tipo']),
      puntoVenta: this.findColumnIndex(headers, ['punto de venta']),
      numero: this.findColumnIndex(headers, ['número desde', 'numero desde']),
      cuitEmisor: this.findColumnIndex(headers, ['nro. doc. emisor', 'doc. emisor']),
      proveedor: this.findColumnIndex(headers, ['denominación emisor', 'denominacion emisor']),
      neto: this.findColumnIndex(headers, ['neto gravado total', 'neto grav. total']),
      iva: this.findColumnIndex(headers, ['total iva', 'iva']),
      total: this.findColumnIndex(headers, ['imp. total', 'importe total', 'total'])
    };
    
    console.log('📍 Mapeo de columnas COMPRAS:', columnMap);
    
    const compras = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // CORRECCIÓN: Validación más robusta
      if (!row || !Array.isArray(row) || row.length === 0) continue;
      
      // Verificar que existe la columna de fecha
      if (columnMap.fecha === -1 || !row[columnMap.fecha]) continue;
      
      const compra = {
        fecha: this.parseDate(row[columnMap.fecha]),
        tipo: row[columnMap.tipo] || '',
        puntoVenta: row[columnMap.puntoVenta] || '',
        numero: row[columnMap.numero] || '',
        cuitProveedor: columnMap.cuitEmisor !== -1 ? this.parseCUIT(row[columnMap.cuitEmisor]) : '',
        proveedor: columnMap.proveedor !== -1 ? (row[columnMap.proveedor] || 'Sin nombre') : 'Sin nombre',
        neto: columnMap.neto !== -1 ? this.parseNumber(row[columnMap.neto]) : 0,
        iva: columnMap.iva !== -1 ? this.parseNumber(row[columnMap.iva]) : 0,
        total: columnMap.total !== -1 ? this.parseNumber(row[columnMap.total]) : 0
      };
      
      // Solo incluir si tiene un total válido
      if (compra.total > 0) {
        compras.push(compra);
        
        if (compras.length <= 3) {
          console.log(`Compra ${compras.length}:`, {
            fecha: compra.fecha.toLocaleDateString('es-AR'),
            proveedor: compra.proveedor,
            total: compra.total
          });
        }
      }
    }
    
    console.log(`✅ Total COMPRAS parseadas: ${compras.length}`);
    return compras;
  }
  
  private parseVentas(headers: any[], rows: any[]): any[] {
    const columnMap = {
      fecha: this.findColumnIndex(headers, ['fecha']),
      tipo: this.findColumnIndex(headers, ['tipo']),
      puntoVenta: this.findColumnIndex(headers, ['punto de venta']),
      numero: this.findColumnIndex(headers, ['número desde', 'numero desde']),
      cuitReceptor: this.findColumnIndex(headers, ['nro. doc. receptor', 'doc. receptor']),
      cliente: this.findColumnIndex(headers, ['denominación receptor', 'denominacion receptor']),
      neto: this.findColumnIndex(headers, ['imp. neto gravado', 'neto gravado']),
      iva: this.findColumnIndex(headers, ['imp. total iva', 'iva']),
      total: this.findColumnIndex(headers, ['imp. total', 'importe total', 'total'])
    };
    
    console.log('📍 Mapeo de columnas VENTAS:', columnMap);
    
    const ventas = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Validación robusta
      if (!row || !Array.isArray(row) || row.length === 0) continue;
      if (columnMap.fecha === -1 || !row[columnMap.fecha]) continue;
      
      const venta = {
        fecha: this.parseDate(row[columnMap.fecha]),
        tipo: row[columnMap.tipo] || '',
        puntoVenta: row[columnMap.puntoVenta] || '',
        numero: row[columnMap.numero] || '',
        cuitCliente: columnMap.cuitReceptor !== -1 ? this.parseCUIT(row[columnMap.cuitReceptor]) : '',
        cliente: columnMap.cliente !== -1 ? (row[columnMap.cliente] || 'Sin nombre') : 'Sin nombre',
        neto: columnMap.neto !== -1 ? this.parseNumber(row[columnMap.neto]) : 0,
        iva: columnMap.iva !== -1 ? this.parseNumber(row[columnMap.iva]) : 0,
        total: columnMap.total !== -1 ? this.parseNumber(row[columnMap.total]) : 0
      };
      
      if (venta.total > 0) {
        ventas.push(venta);
        
        if (ventas.length <= 3) {
          console.log(`Venta ${ventas.length}:`, {
            fecha: venta.fecha.toLocaleDateString('es-AR'),
            cliente: venta.cliente,
            total: venta.total
          });
        }
      }
    }
    
    console.log(`✅ Total VENTAS parseadas: ${ventas.length}`);
    return ventas;
  }
  
  parseBankStatement(buffer: ArrayBuffer) {
    const workbook = XLSX.read(buffer, { 
      type: 'array',
      cellDates: false,
      raw: true
    });
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    if (!rawData || rawData.length < 2) {
      console.error('❌ Extracto bancario vacío');
      return [];
    }
    
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    console.log('🏦 EXTRACTO - Headers:', headers);
    
    const movimientos = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // Validación robusta
      if (!row || !Array.isArray(row)) continue;
      if (!row[0] || (row[2] === null || row[2] === undefined)) continue;
      
      const mov = {
        fecha: this.excelDateToJS(row[0]),
        concepto: row[1] || '',
        importe: parseFloat(row[2]) || 0,
        fechaValor: row[3] ? this.excelDateToJS(row[3]) : null,
        saldo: row[4] !== undefined ? parseFloat(row[4]) : 0
      };
      
      if (mov.importe !== 0) {
        movimientos.push(mov);
        
        if (movimientos.length <= 3) {
          console.log(`Movimiento ${movimientos.length}:`, {
            fecha: mov.fecha.toLocaleDateString('es-AR'),
            concepto: mov.concepto.substring(0, 30),
            importe: mov.importe
          });
        }
      }
    }
    
    console.log(`✅ Total MOVIMIENTOS bancarios: ${movimientos.length}`);
    return movimientos;
  }
  
  // UTILIDADES
  private findColumnIndex(headers: any[], possibleNames: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]?.toString().toLowerCase() || '';
      for (const name of possibleNames) {
        if (header.includes(name.toLowerCase())) {
          return i;
        }
      }
    }
    return -1;
  }
  
  private parseDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value === 'number') return this.excelDateToJS(value);
    if (typeof value === 'string') {
      // Formato DD/MM/YYYY o YYYY-MM-DD
      if (value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
      return new Date(value);
    }
    return new Date();
  }
  
  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remover todo excepto números, punto y coma
      const cleaned = value.replace(/[^0-9.,-]/g, '');
      // Reemplazar coma por punto si es decimal
      const normalized = cleaned.replace(',', '.');
      return parseFloat(normalized) || 0;
    }
    return 0;
  }
  
  private parseCUIT(value: any): string {
    if (!value) return '';
    const str = value.toString();
    // Extraer solo números
    const numbers = str.replace(/[^0-9]/g, '');
    // CUIT debe tener 11 dígitos
    if (numbers.length === 11) {
      return numbers;
    }
    return str;
  }
  
  private excelDateToJS(excelDate: number): Date {
    // Excel dates start from 1900-01-01
    return new Date((excelDate - 25569) * 86400 * 1000);
  }
}
