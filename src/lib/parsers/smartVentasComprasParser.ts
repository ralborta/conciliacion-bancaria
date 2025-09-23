// src/lib/parsers/smartVentasComprasParser.ts
// Parser inteligente para detectar automáticamente formatos de ventas y compras

import * as XLSX from 'xlsx';

export class SmartVentasComprasParser {
  
  parseVentas(buffer: ArrayBuffer): any[] {
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
    }) as any[][];
    
    console.log('📊 VENTAS - Detectando formato automáticamente...');
    
    if (!rawData || rawData.length < 2) {
      console.error('❌ Archivo de ventas vacío');
      return [];
    }
    
    // Detectar headers dinámicamente
    const { headerRow, dataStartRow } = this.findHeaders(rawData);
    console.log('✅ Headers encontrados:', headerRow.filter(h => h).slice(0, 10));
    
    const dataRows = rawData.slice(dataStartRow);
    console.log(`✅ Filas de datos: ${dataRows.length}`);
    
    return this.parseVentasData(headerRow, dataRows);
  }
  
  parseCompras(buffer: ArrayBuffer): any[] {
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
    }) as any[][];
    
    console.log('📊 COMPRAS - Detectando formato automáticamente...');
    
    if (!rawData || rawData.length < 2) {
      console.error('❌ Archivo de compras vacío');
      return [];
    }
    
    // Detectar headers dinámicamente
    const { headerRow, dataStartRow } = this.findHeaders(rawData);
    console.log('✅ Headers encontrados:', headerRow.filter(h => h).slice(0, 10));
    
    const dataRows = rawData.slice(dataStartRow);
    console.log(`✅ Filas de datos: ${dataRows.length}`);
    
    return this.parseComprasData(headerRow, dataRows);
  }
  
  private findHeaders(rawData: any[][]): { headerRow: any[], dataStartRow: number } {
    const firstRow = rawData[0];
    const secondRow = rawData[1];
    
    console.log(`  Fila 0:`, firstRow?.slice(0, 5) || 'vacía');
    console.log(`  Fila 1:`, secondRow?.slice(0, 5) || 'vacía');
    
    let headerRow: any[] = [];
    let dataStartRow = 2;
    
    // Verificar si la primera fila está vacía o tiene título
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
          cell && typeof cell === 'string' && cell.toLowerCase().includes('fecha')
        )) {
          headerRow = row;
          dataStartRow = i + 1;
          break;
        }
      }
    }
    
    if (!headerRow || headerRow.length === 0) {
      console.error('❌ No se encontraron headers válidos');
      return { headerRow: [], dataStartRow: 0 };
    }
    
    return { headerRow, dataStartRow };
  }
  
  private parseVentasData(headers: any[], rows: any[]): any[] {
    console.log('🔍 HEADERS VENTAS:', headers);
    console.log('🔍 PRIMERAS 3 FILAS:', rows.slice(0, 3));
    
    const columnMap = {
      fecha: this.findColumnIndex(headers, ['fecha', 'date', 'fecha_emision']),
      tipo: this.findColumnIndex(headers, ['tipo', 'type', 'tipo_comprobante']),
      puntoVenta: this.findColumnIndex(headers, ['punto de venta', 'punto_venta', 'pv']),
      numero: this.findColumnIndex(headers, ['número desde', 'numero desde', 'comprobar cae', 'numero', 'nro']),
      cuitReceptor: this.findColumnIndex(headers, ['nro. doc. receptor', 'doc. receptor', 'cuit', 'cuit_cliente']),
      cliente: this.findColumnIndex(headers, ['denominación receptor', 'denominacion receptor', 'cliente', 'razon social', 'proveedor']),
      neto: this.findColumnIndex(headers, ['imp. neto gravado', 'neto gravado', 'importe bruto', 'neto', 'subtotal']),
      iva: this.findColumnIndex(headers, ['imp. total iva', 'iva', 'impuestos', 'tax']),
      total: this.findColumnIndex(headers, ['imp. total', 'importe total', 'total', 'monto', 'valor'])
    };
    
    console.log('📍 Mapeo de columnas VENTAS:', columnMap);
    
    const ventas = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || !Array.isArray(row) || row.length === 0) continue;
      if (columnMap.fecha === -1 || !row[columnMap.fecha]) continue;
      
      const venta = {
        fecha: this.parseDate(row[columnMap.fecha]),
        tipo: columnMap.tipo !== -1 ? (row[columnMap.tipo] || '') : '',
        puntoVenta: columnMap.puntoVenta !== -1 ? (row[columnMap.puntoVenta] || '') : '',
        numero: columnMap.numero !== -1 ? (row[columnMap.numero] || '') : '',
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
  
  private parseComprasData(headers: any[], rows: any[]): any[] {
    console.log('🔍 HEADERS COMPRAS:', headers);
    console.log('🔍 PRIMERAS 3 FILAS:', rows.slice(0, 3));
    
    const columnMap = {
      fecha: this.findColumnIndex(headers, ['fecha', 'date', 'fecha_emision']),
      tipo: this.findColumnIndex(headers, ['tipo', 'type', 'tipo_comprobante']),
      puntoVenta: this.findColumnIndex(headers, ['punto de venta', 'punto_venta', 'pv']),
      numero: this.findColumnIndex(headers, ['número desde', 'numero desde', 'comprobar proveedor', 'numero', 'nro']),
      cuitEmisor: this.findColumnIndex(headers, ['nro. doc. emisor', 'doc. emisor', 'cuit', 'cuit_proveedor']),
      proveedor: this.findColumnIndex(headers, ['denominación emisor', 'denominacion emisor', 'proveedor', 'razon social', 'cliente']),
      neto: this.findColumnIndex(headers, ['neto gravado total', 'neto grav. total', 'importe bruto', 'neto', 'subtotal']),
      iva: this.findColumnIndex(headers, ['total iva', 'iva', 'impuestos', 'tax']),
      total: this.findColumnIndex(headers, ['imp. total', 'importe total', 'total', 'monto', 'valor'])
    };
    
    console.log('📍 Mapeo de columnas COMPRAS:', columnMap);
    
    const compras = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || !Array.isArray(row) || row.length === 0) continue;
      if (columnMap.fecha === -1 || !row[columnMap.fecha]) continue;
      
      const compra = {
        fecha: this.parseDate(row[columnMap.fecha]),
        tipo: columnMap.tipo !== -1 ? (row[columnMap.tipo] || '') : '',
        puntoVenta: columnMap.puntoVenta !== -1 ? (row[columnMap.puntoVenta] || '') : '',
        numero: columnMap.numero !== -1 ? (row[columnMap.numero] || '') : '',
        cuitProveedor: columnMap.cuitEmisor !== -1 ? this.parseCUIT(row[columnMap.cuitEmisor]) : '',
        proveedor: columnMap.proveedor !== -1 ? (row[columnMap.proveedor] || 'Sin nombre') : 'Sin nombre',
        neto: columnMap.neto !== -1 ? this.parseNumber(row[columnMap.neto]) : 0,
        iva: columnMap.iva !== -1 ? this.parseNumber(row[columnMap.iva]) : 0,
        total: columnMap.total !== -1 ? this.parseNumber(row[columnMap.total]) : 0
      };
      
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
  
  // UTILIDADES
  private findColumnIndex(headers: any[], possibleNames: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]?.toString().toLowerCase() || '';
      for (const name of possibleNames) {
        if (header.includes(name.toLowerCase())) {
          console.log(`✅ Columna encontrada: "${header}" → "${name}" (índice ${i})`);
          return i;
        }
      }
    }
    console.log(`❌ Columna no encontrada: ${possibleNames.join(', ')}`);
    return -1;
  }
  
  private parseDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value === 'number') return this.excelDateToJS(value);
    if (typeof value === 'string') {
      // Formato DD/MM/YYYY
      if (value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
              console.log(`✅ Fecha parseada: ${value} -> ${date.toLocaleDateString('es-AR')}`);
              return date;
            }
          }
        }
      }
      // Formato YYYY-MM-DD
      if (value.includes('-')) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          console.log(`✅ Fecha ISO parseada: ${value} -> ${date.toLocaleDateString('es-AR')}`);
          return date;
        }
      }
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        console.log(`✅ Fecha estándar parseada: ${value} -> ${date.toLocaleDateString('es-AR')}`);
        return date;
      }
    }
    console.warn(`⚠️ No se pudo parsear fecha: ${value}, usando fecha actual`);
    return new Date();
  }
  
  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remover todo excepto números, punto, coma y signo menos
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
