// src/lib/parsers/smartExtractoParser.ts
// Parser inteligente para detectar automáticamente 3 formatos de extracto bancario

import * as XLSX from 'xlsx';

export class SmartExtractoParser {
  
  parseExtracto(buffer: ArrayBuffer): any[] {
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
    
    console.log('🏦 EXTRACTO - Detectando formato automáticamente...');
    console.log('📊 Headers encontrados:', rawData[0]);
    
    // Detectar formato automáticamente
    const formato = this.detectFormat(rawData[0]);
    console.log(`✅ Formato detectado: ${formato}`);
    
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    return this.parseByFormat(formato, headers, dataRows);
  }
  
  private detectFormat(headers: any[]): 'formato1' | 'formato2' | 'formato3' | 'formato4' {
    const headerStr = headers.map(h => String(h || '').toLowerCase()).join('|');
    
    console.log('🔍 Analizando headers:', headerStr);
    
    // FORMATO 1: Fecha, Marca, Concepto, Débito, Crédito, Saldo, Cuenta
    if (headerStr.includes('marca') && headerStr.includes('débito') && headerStr.includes('crédito')) {
      return 'formato1';
    }
    
    // FORMATO 2: Fecha, Concepto, Débito, Crédito, Saldo, Cuenta
    if (headerStr.includes('débito') && headerStr.includes('crédito') && !headerStr.includes('marca')) {
      return 'formato2';
    }
    
    // FORMATO 3: Fecha, Concepto, Importe, Fecha Valor, Saldo
    if (headerStr.includes('importe') && !headerStr.includes('débito') && !headerStr.includes('crédito')) {
      return 'formato3';
    }
    
    // FORMATO 4: fecha, comprobante, movimiento, debito, credito, saldo (formato personalizado)
    if (headerStr.includes('debito') && headerStr.includes('credito') && headerStr.includes('movimiento')) {
      return 'formato4';
    }
    
    // Fallback: intentar detectar por posición de columnas
    if (headers.length >= 6) {
      return 'formato1'; // Asumir formato 1 si tiene muchas columnas
    } else if (headers.length >= 5) {
      return 'formato2'; // Asumir formato 2 si tiene 5+ columnas
    } else {
      return 'formato3'; // Asumir formato 3 por defecto
    }
  }
  
  private parseByFormat(formato: string, headers: any[], dataRows: any[]): any[] {
    switch (formato) {
      case 'formato1':
        return this.parseFormato1(headers, dataRows);
      case 'formato2':
        return this.parseFormato2(headers, dataRows);
      case 'formato3':
        return this.parseFormato3(headers, dataRows);
      case 'formato4':
        return this.parseFormato4(headers, dataRows);
      default:
        return this.parseFormato3(headers, dataRows);
    }
  }
  
  private parseFormato1(headers: any[], dataRows: any[]): any[] {
    console.log('📊 Parseando FORMATO 1: Fecha, Marca, Concepto, Débito, Crédito, Saldo, Cuenta');
    
    const movimientos = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      if (!row || !Array.isArray(row) || row.length < 6) continue;
      if (!row[0] || (row[3] === null && row[4] === null)) continue;
      
      const debito = this.parseNumber(row[3]) || 0;
      const credito = this.parseNumber(row[4]) || 0;
      const importe = credito - debito; // Crédito - Débito
      
      if (importe !== 0) {
        const mov = {
          fecha: this.parseDate(row[0]),
          concepto: row[2] || '',
          importe: importe,
          fechaValor: row[5] ? this.parseDate(row[5]) : null,
          saldo: row[6] !== undefined ? this.parseNumber(row[6]) : 0,
          cuenta: row[7] || '',
          marca: row[1] || ''
        };
        
        movimientos.push(mov);
        
        if (movimientos.length <= 3) {
          console.log(`Movimiento ${movimientos.length}:`, {
            fecha: mov.fecha.toLocaleDateString('es-AR'),
            concepto: mov.concepto.substring(0, 30),
            importe: mov.importe,
            tipo: importe > 0 ? 'CRÉDITO' : 'DÉBITO'
          });
        }
      }
    }
    
    console.log(`✅ Total MOVIMIENTOS Formato 1: ${movimientos.length}`);
    return movimientos;
  }
  
  private parseFormato2(headers: any[], dataRows: any[]): any[] {
    console.log('📊 Parseando FORMATO 2: Fecha, Concepto, Débito, Crédito, Saldo, Cuenta');
    
    const movimientos = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      if (!row || !Array.isArray(row) || row.length < 5) continue;
      if (!row[0] || (row[2] === null && row[3] === null)) continue;
      
      const debito = this.parseNumber(row[2]) || 0;
      const credito = this.parseNumber(row[3]) || 0;
      const importe = credito - debito; // Crédito - Débito
      
      if (importe !== 0) {
        const mov = {
          fecha: this.parseDate(row[0]),
          concepto: row[1] || '',
          importe: importe,
          fechaValor: row[4] ? this.parseDate(row[4]) : null,
          saldo: row[5] !== undefined ? this.parseNumber(row[5]) : 0,
          cuenta: row[6] || ''
        };
        
        movimientos.push(mov);
        
        if (movimientos.length <= 3) {
          console.log(`Movimiento ${movimientos.length}:`, {
            fecha: mov.fecha.toLocaleDateString('es-AR'),
            concepto: mov.concepto.substring(0, 30),
            importe: mov.importe,
            tipo: importe > 0 ? 'CRÉDITO' : 'DÉBITO'
          });
        }
      }
    }
    
    console.log(`✅ Total MOVIMIENTOS Formato 2: ${movimientos.length}`);
    return movimientos;
  }
  
  private parseFormato3(headers: any[], dataRows: any[]): any[] {
    console.log('📊 Parseando FORMATO 3: Fecha, Concepto, Importe, Fecha Valor, Saldo');
    
    const movimientos = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      if (!row || !Array.isArray(row) || row.length < 3) continue;
      if (!row[0] || row[2] === null || row[2] === undefined) continue;
      
      const importe = this.parseNumber(row[2]);
      
      if (importe !== 0) {
        const mov = {
          fecha: this.parseDate(row[0]),
          concepto: row[1] || '',
          importe: importe,
          fechaValor: row[3] ? this.parseDate(row[3]) : null,
          saldo: row[4] !== undefined ? this.parseNumber(row[4]) : 0
        };
        
        movimientos.push(mov);
        
        if (movimientos.length <= 3) {
          console.log(`Movimiento ${movimientos.length}:`, {
            fecha: mov.fecha.toLocaleDateString('es-AR'),
            concepto: mov.concepto.substring(0, 30),
            importe: mov.importe,
            tipo: importe > 0 ? 'CRÉDITO' : 'DÉBITO'
          });
        }
      }
    }
    
    console.log(`✅ Total MOVIMIENTOS Formato 3: ${movimientos.length}`);
    return movimientos;
  }
  
  private parseFormato4(headers: any[], dataRows: any[]): any[] {
    console.log('📊 Parseando FORMATO 4: fecha, comprobante, movimiento, debito, credito, saldo');
    
    const movimientos = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      if (!row || !Array.isArray(row) || row.length < 6) continue;
      if (!row[0] || (row[3] === null && row[4] === null)) continue;
      
      const debito = this.parseNumber(row[3]) || 0;
      const credito = this.parseNumber(row[4]) || 0;
      const importe = credito - debito; // Crédito - Débito
      
      if (importe !== 0) {
        const mov = {
          fecha: this.parseDate(row[0]),
          concepto: row[2] || '',
          importe: importe,
          fechaValor: null,
          saldo: row[5] !== undefined ? this.parseNumber(row[5]) : 0,
          cuenta: '',
          comprobante: row[1] || ''
        };
        
        movimientos.push(mov);
        
        if (movimientos.length <= 3) {
          console.log(`Movimiento ${movimientos.length}:`, {
            fecha: mov.fecha.toLocaleDateString('es-AR'),
            concepto: mov.concepto.substring(0, 30),
            importe: mov.importe,
            tipo: importe > 0 ? 'CRÉDITO' : 'DÉBITO'
          });
        }
      }
    }
    
    console.log(`✅ Total MOVIMIENTOS Formato 4: ${movimientos.length}`);
    return movimientos;
  }
  
  // UTILIDADES
  private parseDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value === 'number') return this.excelDateToJS(value);
    if (typeof value === 'string') {
      // Formato YYYY-MM-DD o DD/MM/YYYY
      if (value.includes('-')) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      if (value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        }
      }
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
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
  
  private excelDateToJS(excelDate: number): Date {
    // Excel dates start from 1900-01-01
    return new Date((excelDate - 25569) * 86400 * 1000);
  }
}
