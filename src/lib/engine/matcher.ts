import { VentaCanon, CompraCanon, ExtractoCanon, MatchResult, ProcessOptions, MatchingRules } from '@/lib/types/conciliacion'

export class ConciliationEngine {
  private rules: MatchingRules

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
  }

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
      const matches = this.runMatching(
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

  private async parseFile(file: File): Promise<any[]> {
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (extension === 'csv') {
      return this.parseCSV(file)
    } else if (extension === 'xlsx' || extension === 'xls') {
      return this.parseExcel(file)
    } else {
      throw new Error(`Formato de archivo no soportado: ${extension}`)
    }
  }

  private async parseCSV(file: File): Promise<any[]> {
    const Papa = await import('papaparse')
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error('Error al parsear CSV'))
          } else {
            resolve(results.data)
          }
        },
        error: (error) => reject(error)
      })
    })
  }

  private async parseExcel(file: File): Promise<any[]> {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const buffer = await file.arrayBuffer()
    await workbook.xlsx.load(buffer)
    
    const worksheet = workbook.worksheets[0]
    const rows: any[] = []
    
    // Get headers from first row
    const headers: string[] = []
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value?.toString() || ''
    })
    
    // Get data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header
      
      const rowData: any = {}
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

  private normalizeVentas(data: any[]): VentaCanon[] {
    return data.map((item, index) => ({
      id: `venta_${index}`,
      fechaEmision: new Date(item.fecha_emision || item.fecha),
      fechaCobroEstimada: item.fecha_cobro ? new Date(item.fecha_cobro) : undefined,
      medioCobro: item.medio_cobro || item.medio || 'Transferencia',
      moneda: item.moneda || 'ARS',
      neto: parseFloat(item.neto || item.subtotal || 0),
      iva: item.iva ? parseFloat(item.iva) : undefined,
      total: parseFloat(item.total || item.monto || 0),
      cuitCliente: item.cuit_cliente || item.cuit,
      cbuCvuCliente: item.cbu_cliente || item.cbu,
      referenciaExterna: item.referencia || item.ref
    }))
  }

  private normalizeCompras(data: any[]): CompraCanon[] {
    return data.map((item, index) => ({
      id: `compra_${index}`,
      fechaEmision: new Date(item.fecha_emision || item.fecha),
      fechaPagoEstimada: item.fecha_pago ? new Date(item.fecha_pago) : undefined,
      formaPago: item.forma_pago || item.medio || 'Transferencia',
      moneda: item.moneda || 'ARS',
      neto: parseFloat(item.neto || item.subtotal || 0),
      iva: item.iva ? parseFloat(item.iva) : undefined,
      total: parseFloat(item.total || item.monto || 0),
      cuitProveedor: item.cuit_proveedor || item.cuit,
      cbuCvuProveedor: item.cbu_proveedor || item.cbu,
      ordenPago: item.orden_pago || item.op
    }))
  }

  private normalizeExtracto(data: any[], banco: string): ExtractoCanon[] {
    const bancoConfig = this.getBancoConfig(banco)
    
    return data.map((item, index) => ({
      id: `extracto_${index}`,
      banco,
      cuenta: item.cuenta || item.numero_cuenta || '',
      fechaOperacion: new Date(item[bancoConfig.campos.fecha] || item.fecha),
      fechaValor: item.fecha_valor ? new Date(item.fecha_valor) : undefined,
      concepto: item[bancoConfig.campos.concepto] || item.concepto || '',
      importe: parseFloat(item[bancoConfig.campos.importe] || item.importe || 0),
      saldo: item.saldo ? parseFloat(item.saldo) : undefined,
      cuitContraparte: item[bancoConfig.campos.cuit] || item.cuit,
      cbuCvuContraparte: item[bancoConfig.campos.cbu] || item.cbu,
      referencia: item[bancoConfig.campos.referencia] || item.referencia
    }))
  }

  private getBancoConfig(banco: string) {
    // Mapeo básico de campos por banco
    const configs: Record<string, any> = {
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
      }
    }
    
    return configs[banco] || configs['Santander']
  }

  private runMatching(
    ventas: VentaCanon[],
    compras: CompraCanon[],
    extracto: ExtractoCanon[]
  ): MatchResult[] {
    const matches: MatchResult[] = []
    
    for (const extractoItem of extracto) {
      let bestMatch: MatchResult | null = null
      let bestScore = 0
      
      // Try to match with ventas
      for (const venta of ventas) {
        const score = this.calculateMatchScore(extractoItem, venta, 'venta')
        if (score > bestScore && score >= 0.7) {
          bestScore = score
          bestMatch = {
            id: `match_${extractoItem.id}`,
            extractoItem,
            matchedWith: venta,
            score,
            status: score >= 0.9 ? 'matched' : 'suggested',
            tipo: 'venta',
            reason: this.getMatchReason(extractoItem, venta, score)
          }
        }
      }
      
      // Try to match with compras
      for (const compra of compras) {
        const score = this.calculateMatchScore(extractoItem, compra, 'compra')
        if (score > bestScore && score >= 0.7) {
          bestScore = score
          bestMatch = {
            id: `match_${extractoItem.id}`,
            extractoItem,
            matchedWith: compra,
            score,
            status: score >= 0.9 ? 'matched' : 'suggested',
            tipo: 'compra',
            reason: this.getMatchReason(extractoItem, compra, score)
          }
        }
      }
      
      // If no good match found, mark as pending
      if (!bestMatch) {
        bestMatch = {
          id: `match_${extractoItem.id}`,
          extractoItem,
          matchedWith: null,
          score: 0,
          status: 'pending',
          reason: 'No se encontró coincidencia'
        }
      }
      
      matches.push(bestMatch)
    }
    
    return matches
  }

  private calculateMatchScore(
    extracto: ExtractoCanon,
    item: VentaCanon | CompraCanon,
    tipo: 'venta' | 'compra'
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
    const itemDate = 'fechaEmision' in item ? item.fechaEmision : item.fechaEmision
    const dateDiff = Math.abs(extractoDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (dateDiff <= this.rules.dateTolerance) {
      score += 0.3
    } else {
      score += Math.max(0, 0.3 - (dateDiff / 30) * 0.3)
    }
    factors += 0.3
    
    // CBU/CUIT match (20% weight)
    if (this.rules.cbuMatch && extracto.cbuCvuContraparte && item.cbuCvuCliente) {
      if (extracto.cbuCvuContraparte === item.cbuCvuCliente) {
        score += 0.2
      }
    }
    if (this.rules.cuitMatch && extracto.cuitContraparte && item.cuitCliente) {
      if (extracto.cuitContraparte === item.cuitCliente) {
        score += 0.2
      }
    }
    factors += 0.2
    
    // Reference match (10% weight)
    if (extracto.referencia && item.referenciaExterna) {
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
    score: number
  ): string {
    const reasons = []
    
    if (Math.abs(extracto.importe - item.total) < item.total * 0.01) {
      reasons.push('Importe exacto')
    }
    
    const dateDiff = Math.abs(extracto.fechaOperacion.getTime() - item.fechaEmision.getTime()) / (1000 * 60 * 60 * 24)
    if (dateDiff <= 1) {
      reasons.push('Fecha cercana')
    }
    
    if (extracto.cbuCvuContraparte && item.cbuCvuCliente && extracto.cbuCvuContraparte === item.cbuCvuCliente) {
      reasons.push('CBU coincidente')
    }
    
    if (extracto.cuitContraparte && item.cuitCliente && extracto.cuitContraparte === item.cuitCliente) {
      reasons.push('CUIT coincidente')
    }
    
    if (extracto.referencia && item.referenciaExterna && extracto.referencia === item.referenciaExterna) {
      reasons.push('Referencia exacta')
    }
    
    return reasons.join(', ') || 'Coincidencia parcial'
  }
}
