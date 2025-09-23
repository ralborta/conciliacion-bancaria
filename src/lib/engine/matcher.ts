import { VentaCanon, CompraCanon, ExtractoCanon, MatchResult, ProcessOptions, MatchingRules } from '@/lib/types/conciliacion'
import { ArgentinaMatchingEngine } from './argentinaMatcher'
import { excelDateToJSDate, extractCUITFromConcept, extractSupplierName } from './bankFormats'
import { SmartExtractoParser } from '../parsers/smartExtractoParser'

export class ConciliationEngine {
  private smartExtractoParser: SmartExtractoParser
  
  constructor(rules?: Partial<MatchingRules>) {
    this.rules = {
      exactMatch: true,
      fuzzyMatch: true,
      dateTolerance: 3,
      amountTolerance: 0.01, // 1%
      cbuMatch: true,
      cuitMatch: true,
      ...rules
    }
    this.smartExtractoParser = new SmartExtractoParser()
  }
  
  // AGREGAR ESTA FUNCIÓN AL INICIO DE matcher.ts
  private parseDate(dateValue: any): Date {
    try {
      if (!dateValue) return new Date();
      if (dateValue instanceof Date) return dateValue;
      
      // Si es string DD/MM/YYYY (formato argentino)
      if (typeof dateValue === 'string' && dateValue.includes('/')) {
        const parts = dateValue.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;  // Restar 1 para índice de mes (0-11)
          const year = parseInt(parts[2], 10);
          // CORREGIDO: Validación de rangos correcta
          if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
              console.log(`✅ Fecha parseada en matcher: ${dateValue} -> ${date.toLocaleDateString('es-AR')}`);
              return date;
            }
          } else {
            console.warn(`⚠️ Fecha fuera de rango en matcher: ${dateValue} (day: ${day}, month: ${month + 1}, year: ${year})`);
          }
        }
      }
      
      // Fallback al comportamiento original
      const date = new Date(String(dateValue));
      if (!isNaN(date.getTime())) {
        return date;
      }
      return new Date(); // Fecha actual como fallback seguro
    } catch (error) {
      console.warn('Error parsing date in matcher:', dateValue, error);
      return new Date(); // Fecha actual como fallback seguro
    }
  }
  private rules: MatchingRules

  async processFiles(
    ventas: File,
    compras: File,
    extracto: File,
    options: ProcessOptions
  ): Promise<MatchResult[]> {
    try {
      // 1. Parse files
      const ventasData = await this.parseFile(ventas)
      const comprasData = await this.parseFile(compras)
      const extractoData = await this.parseFile(extracto)
      
      // 2. Normalize to canonical format
      const ventasNorm = this.normalizeVentas(ventasData)
      const comprasNorm = this.normalizeCompras(comprasData)
      const extractoNorm = this.normalizeExtracto(extractoData, options.banco)
      
      // 3. Run matching engine
      const matches = await this.runMatching(
        ventasNorm,
        comprasNorm,
        extractoNorm
      )
      
      return matches
    } catch (error) {
      console.error('Error processing files:', error)
      throw new Error('Error al procesar los archivos')
    }
  }

  private async parseFile(file: File): Promise<Record<string, unknown>[]> {
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (extension === 'csv') {
      return this.parseCSV(file)
    } else if (extension === 'xlsx' || extension === 'xls') {
      return this.parseExcel(file)
    } else {
      throw new Error(`Formato de archivo no soportado: ${extension}`)
    }
  }

  private async parseCSV(file: File): Promise<Record<string, unknown>[]> {
    const Papa = await import('papaparse')
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error('Error al parsear CSV'))
          } else {
            resolve(results.data as Record<string, unknown>[])
          }
        },
        error: (error) => reject(error)
      })
    })
  }

  private async parseExcel(file: File): Promise<Record<string, unknown>[]> {
    console.log('📊 PARSING EXCEL CON PARSER INTELIGENTE')
    
    // Determinar si es extracto bancario por el nombre del archivo
    const fileName = file.name.toLowerCase()
    const isExtracto = fileName.includes('extracto') || fileName.includes('movimiento') || fileName.includes('banco')
    
    if (isExtracto) {
      console.log('🏦 Detectado como extracto bancario, usando parser inteligente')
      const buffer = await file.arrayBuffer()
      const extractoData = this.smartExtractoParser.parseExtracto(buffer)
      
      // Marcar como datos de Excel para el normalizador
      return extractoData.map(item => ({
        ...item,
        _isExcelData: true
      }))
    }
    
    // Para ventas/compras, usar el método original
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const buffer = await file.arrayBuffer()
    await workbook.xlsx.load(buffer)
    
    const worksheet = workbook.worksheets[0]
    const rows: Record<string, unknown>[] = []
    
    // Get headers from first row
    const headers: string[] = []
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value?.toString() || ''
    })
    
    // Get data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header
      
      const rowData: Record<string, unknown> = {}
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1]
        if (header) {
          rowData[header] = cell.value
        }
      })
      rows.push(rowData)
    })
    
    return rows
  }

  private normalizeVentas(data: Record<string, unknown>[]): VentaCanon[] {
    return data.map((item, index) => ({
      id: `venta_${index}`,
      fechaEmision: this.parseDate(item.fecha_emision || item.fecha),
      fechaCobroEstimada: item.fecha_cobro ? this.parseDate(item.fecha_cobro) : undefined,
      medioCobro: String(item.medio_cobro || item.medio || 'Transferencia'),
      moneda: String(item.moneda || 'ARS'),
      neto: parseFloat(String(item.neto || item.subtotal || 0)),
      iva: item.iva ? parseFloat(String(item.iva)) : undefined,
      total: parseFloat(String(item.total || item.monto || 0)),
      cuitCliente: item.cuit_cliente ? String(item.cuit_cliente) : undefined,
      cbuCvuCliente: item.cbu_cliente ? String(item.cbu_cliente) : undefined,
      referenciaExterna: item.referencia ? String(item.referencia) : undefined
    }))
  }

  private normalizeCompras(data: Record<string, unknown>[]): CompraCanon[] {
    return data.map((item, index) => ({
      id: `compra_${index}`,
      fechaEmision: this.parseDate(item.fecha_emision || item.fecha),
      fechaPagoEstimada: item.fecha_pago ? this.parseDate(item.fecha_pago) : undefined,
      formaPago: String(item.forma_pago || item.medio || 'Transferencia'),
      moneda: String(item.moneda || 'ARS'),
      neto: parseFloat(String(item.neto || item.subtotal || 0)),
      iva: item.iva ? parseFloat(String(item.iva)) : undefined,
      total: parseFloat(String(item.total || item.monto || 0)),
      cuitProveedor: String(item.cuit_proveedor || item.cuit),
      cbuCvuProveedor: item.cbu_proveedor ? String(item.cbu_proveedor) : undefined,
      ordenPago: item.orden_pago ? String(item.orden_pago) : undefined
    }))
  }

  private normalizeExtracto(data: Record<string, unknown>[], banco: string): ExtractoCanon[] {
    console.log('🔍 NORMALIZANDO EXTRACTO CON PARSER INTELIGENTE')
    
    // Si es un archivo Excel, usar el parser inteligente
    if (data.length > 0 && data[0]._isExcelData) {
      console.log('📊 Usando parser inteligente para extracto Excel')
      // El parser inteligente ya devuelve el formato correcto
      return data as ExtractoCanon[]
    }
    
    // Fallback al método original para CSV
    const bancoConfig = this.getBancoConfig(banco)
    
    return data.map((item, index) => {
      // Manejar fechas de Excel para Banco Provincia
      let fechaOperacion: Date
      if (banco === 'Banco Provincia' && typeof item[bancoConfig.campos.fecha] === 'number') {
        fechaOperacion = excelDateToJSDate(Number(item[bancoConfig.campos.fecha]))
      } else {
        fechaOperacion = this.parseDate(item[bancoConfig.campos.fecha] || item.fecha)
      }

      const concepto = String(item[bancoConfig.campos.concepto] || item.concepto || '')
      
      // NUEVA: Detección automática de formato de extracto
      const { importe, tipo } = this.detectarFormatoExtracto(item);
      
      // 🔍 DEBUG: Ver qué está pasando con el concepto y formato
      if (index < 3) {
        console.log(`🔍 NORMALIZANDO MOVIMIENTO ${index + 1}:`);
        console.log(`  - Formato detectado: ${tipo}, Importe: ${importe}`);
        console.log(`  - concepto: "${concepto}"`);
        console.log(`  - item completo:`, JSON.stringify(item, null, 2));
      }
      
      return {
        id: `extracto_${index}`,
        banco,
        cuenta: String(item.cuenta || item.numero_cuenta || ''),
        fechaOperacion,
        fechaValor: item.fecha_valor ? this.parseDate(item.fecha_valor) : undefined,
        concepto,
        importe, // Usar el importe detectado automáticamente
        saldo: item.saldo ? parseFloat(String(item.saldo)) : undefined,
        cuitContraparte: extractCUITFromConcept(concepto) || (item[bancoConfig.campos.cuit] ? String(item[bancoConfig.campos.cuit]) : undefined),
        cbuCvuContraparte: item[bancoConfig.campos.cbu] ? String(item[bancoConfig.campos.cbu]) : undefined,
        referencia: item[bancoConfig.campos.referencia] ? String(item[bancoConfig.campos.referencia]) : undefined
      }
    })
  }

  private parseNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    
    // Si ya es un número, devolverlo
    if (typeof value === 'number') return value;
    
    // Convertir a string y limpiar
    let str = String(value).trim();
    
    // Si está vacío, devolver 0
    if (str === '') return 0;
    
    // MANEJAR SEPARADORES DE MILES Y DECIMALES
    // Formato argentino: 1.231.287,21 → 1231287.21
    // Formato internacional: 1,231,287.21 → 1231287.21
    
    // Si tiene punto como separador de miles y coma como decimal
    if (str.includes('.') && str.includes(',') && str.lastIndexOf('.') > str.lastIndexOf(',')) {
      // Formato argentino: 1.231.287,21
      str = str.replace(/\./g, '').replace(',', '.');
    }
    // Si solo tiene comas (probablemente separador de miles)
    else if (str.includes(',') && !str.includes('.')) {
      // Formato: 1,231,287 → 1231287
      str = str.replace(/,/g, '');
    }
    // Si tiene comas y puntos, y la coma está antes del último punto
    else if (str.includes(',') && str.includes('.') && str.lastIndexOf(',') < str.lastIndexOf('.')) {
      // Formato internacional: 1,231,287.21
      str = str.replace(/,/g, '');
    }
    
    // Intentar parsear como número
    const num = parseFloat(str);
    
    // Si es NaN, devolver 0
    if (isNaN(num)) {
      console.log(`⚠️ No se pudo parsear número: "${value}" → "${str}"`);
      return 0;
    }
    
    return num;
  }

  // NUEVA: Detección automática de formato de extracto para VENTAS
  private detectarFormatoExtracto(item: Record<string, unknown>): { importe: number, tipo: 'ingreso' | 'egreso' | 'neutro' } {
    // 1º Verificar si tiene campo 'importe' único (solo ingresos para ventas)
    if (item.importe !== undefined) {
      const importe = this.parseNumber(item.importe);
      if (importe > 0) {
        return { importe, tipo: 'ingreso' };
      }
    }
    
    // 2º Verificar si tiene CRÉDITO separado (solo ingresos para ventas)
    if (item.credito !== undefined && this.parseNumber(item.credito) > 0) {
      return {
        importe: +this.parseNumber(item.credito), // Positivo (ingreso)
        tipo: 'ingreso'
      };
    }
    
    // 3º Verificar FECHA (segunda prioridad)
    if (item.fecha !== undefined) {
      const fecha = this.parseDate(item.fecha);
      // Si hay fecha pero no monto, intentar con débito como egreso
      if (item.debito && this.parseNumber(item.debito) > 0) {
        return {
          importe: -this.parseNumber(item.debito), // Negativo (egreso)
          tipo: 'egreso'
        };
      }
    }
    
    // Si no se puede determinar, devolver neutro
    return { importe: 0, tipo: 'neutro' };
  }

  private getBancoConfig(banco: string) {
    // Mapeo básico de campos por banco
    const configs: Record<string, { campos: Record<string, string> }> = {
      'Santander': {
        campos: {
          fecha: 'fecha_operacion',
          concepto: 'concepto',
          importe: 'importe',
          referencia: 'referencia',
          cuit: 'cuit_contraparte',
          cbu: 'cbu_contraparte'
        }
      },
      'BBVA': {
        campos: {
          fecha: 'fecha',
          concepto: 'descripcion',
          importe: 'monto',
          referencia: 'ref',
          cuit: 'cuit',
          cbu: 'cbu'
        }
      },
      'Galicia': {
        campos: {
          fecha: 'fecha_op',
          concepto: 'concepto',
          importe: 'importe',
          referencia: 'referencia',
          cuit: 'cuit',
          cbu: 'cbu'
        }
      },
      'Banco Provincia': {
        campos: {
          fecha: 'A', // Columna A
          concepto: 'B', // Columna B
          importe: 'C', // Columna C
          referencia: 'referencia',
          cuit: 'cuit',
          cbu: 'cbu'
        }
      }
    }
    
    return configs[banco] || configs['Santander']
  }

  async runMatching(
    ventas: VentaCanon[],
    compras: CompraCanon[],
    extracto: ExtractoCanon[]
  ): Promise<MatchResult[]> {
    // Usar el motor argentino para mejor matching
    const argentinaEngine = new ArgentinaMatchingEngine()
    return await argentinaEngine.processArgentinaMatching(ventas, compras, extracto)
  }

  private calculateMatchScore(
    extracto: ExtractoCanon,
    item: VentaCanon | CompraCanon,
    _tipo: 'venta' | 'compra'
  ): number {
    let score = 0
    let factors = 0
    
    // Amount match (40% weight)
    const amountDiff = Math.abs(extracto.importe - item.total)
    const amountTolerance = item.total * this.rules.amountTolerance
    if (amountDiff <= amountTolerance) {
      score += 0.4
    } else {
      score += Math.max(0, 0.4 - (amountDiff / item.total) * 0.4)
    }
    factors += 0.4
    
    // Date match (30% weight)
    const extractoDate = extracto.fechaOperacion
    const itemDate = item.fechaEmision
    const dateDiff = Math.abs(extractoDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (dateDiff <= this.rules.dateTolerance) {
      score += 0.3
    } else {
      score += Math.max(0, 0.3 - (dateDiff / 30) * 0.3)
    }
    factors += 0.3
    
    // CBU/CUIT match (20% weight)
    if (this.rules.cbuMatch && extracto.cbuCvuContraparte && 'cbuCvuCliente' in item && item.cbuCvuCliente) {
      if (extracto.cbuCvuContraparte === item.cbuCvuCliente) {
        score += 0.2
      }
    }
    if (this.rules.cuitMatch && extracto.cuitContraparte && 'cuitCliente' in item && item.cuitCliente) {
      if (extracto.cuitContraparte === item.cuitCliente) {
        score += 0.2
      }
    }
    factors += 0.2
    
    // Reference match (10% weight)
    if (extracto.referencia && 'referenciaExterna' in item && item.referenciaExterna) {
      if (extracto.referencia === item.referenciaExterna) {
        score += 0.1
      } else if (this.rules.fuzzyMatch) {
        const similarity = this.calculateStringSimilarity(extracto.referencia, item.referenciaExterna)
        score += similarity * 0.1
      }
    }
    factors += 0.1
    
    return factors > 0 ? score / factors : 0
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  private getMatchReason(
    extracto: ExtractoCanon,
    item: VentaCanon | CompraCanon,
    _score: number
  ): string {
    const reasons = []
    
    if (Math.abs(extracto.importe - item.total) < item.total * 0.01) {
      reasons.push('Importe exacto')
    }
    
    const dateDiff = Math.abs(extracto.fechaOperacion.getTime() - item.fechaEmision.getTime()) / (1000 * 60 * 60 * 24)
    if (dateDiff <= 1) {
      reasons.push('Fecha cercana')
    }
    
    if (extracto.cbuCvuContraparte && 'cbuCvuCliente' in item && item.cbuCvuCliente && extracto.cbuCvuContraparte === item.cbuCvuCliente) {
      reasons.push('CBU coincidente')
    }
    
    if (extracto.cuitContraparte && 'cuitCliente' in item && item.cuitCliente && extracto.cuitContraparte === item.cuitCliente) {
      reasons.push('CUIT coincidente')
    }
    
    if (extracto.referencia && 'referenciaExterna' in item && item.referenciaExterna && extracto.referencia === item.referenciaExterna) {
      reasons.push('Referencia exacta')
    }
    
    return reasons.join(', ') || 'Coincidencia parcial'
  }
}
