import { ConciliationEngine } from './matcher'
import { VentaCanon, CompraCanon, MatchResult, ProcessOptions } from '@/lib/types/conciliacion'
import { SmartVentasComprasParser } from '../parsers/smartVentasComprasParser'
import { SmartExtractoParser } from '../parsers/smartExtractoParser'

interface BankProcessingStep {
  bankName: string
  processedAt: Date
  matchedCount: number
  pendingCount: number
  totalVentas: number
  totalCompras: number
  ventasConciliadas: number
  comprasConciliadas: number
}

interface MultiBankResult {
  steps: BankProcessingStep[]
  allMatched: MatchResult[]
  allPending: MatchResult[]
  totalMatched: number
  totalPending: number
  matchRate: number
  consolidatedAsientos: unknown[]
  summary: {
    totalBanks: number
    totalMovimientos: number
    totalConciliados: number
    totalPendientes: number
    matchRate: number
  }
}

export class MultiBankReconciliationOrchestrator {
  private engine: ConciliationEngine
  private processingSteps: BankProcessingStep[] = []
  private allMatched: MatchResult[] = []
  private allPending: MatchResult[] = []
  private allAsientos: unknown[] = []
  
  // Estado de transacciones ya conciliadas
  private conciliadasVentas = new Set<string>()
  private conciliadasCompras = new Set<string>()
  
  // Archivos base (se mantienen para cada banco)
  private ventasFile: File | null = null
  private comprasFile: File | null = null
  
  // Datos parseados una sola vez
  private ventasData: VentaCanon[] = []
  private comprasData: CompraCanon[] = []
  private initialized: boolean = false
  
  // Parsers inteligentes
  private smartVentasComprasParser: SmartVentasComprasParser
  private smartExtractoParser: SmartExtractoParser
  
  constructor() {
    this.engine = new ConciliationEngine()
    this.smartVentasComprasParser = new SmartVentasComprasParser()
    this.smartExtractoParser = new SmartExtractoParser()
  }

  /**
   * Inicializa el proceso con los archivos originales de ventas y compras
   */
  async initialize(ventasFile: File, comprasFile: File): Promise<void> {
    console.log('🚀 Inicializando conciliación multi-banco...')
    
    // Guardar archivos base para usar en cada banco
    this.ventasFile = ventasFile
    this.comprasFile = comprasFile
    
    // Resetear estado
    this.processingSteps = []
    this.allMatched = []
    this.allPending = []
    this.allAsientos = []
    this.conciliadasVentas.clear()
    this.conciliadasCompras.clear()
    
    // Parsear archivos base UNA SOLA VEZ
    console.log(`📊 Parseando archivos base...`)
    this.ventasData = await this.parseVentas(ventasFile)
    this.comprasData = await this.parseCompras(comprasFile)
    
    console.log(`📊 Ventas parseadas: ${this.ventasData.length}`)
    console.log(`📊 Compras parseadas: ${this.comprasData.length}`)
    console.log(`📊 Archivos base guardados para procesamiento secuencial`)
    console.log(`📊 Estado reseteado para nuevo proceso multi-banco`)
    
    this.initialized = true
  }

  /**
   * Verifica si el orquestador ya está inicializado
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Procesa un banco con ventas, compras y extracto
   * Solo procesa las transacciones que no han sido conciliadas en bancos anteriores
   */
  async processBank(
    extractFile: File,
    bankName: string,
    options: ProcessOptions
  ): Promise<MatchResult[]> {
    
    if (!this.ventasFile || !this.comprasFile) {
      throw new Error('Debe inicializar primero con ventas y compras')
    }
    
    console.log(`\n🏦 Procesando banco: ${bankName}`)
    console.log(`📊 Ventas ya conciliadas: ${this.conciliadasVentas.size}`)
    console.log(`📊 Compras ya conciliadas: ${this.conciliadasCompras.size}`)

    // 1. Usar datos ya parseados (NO re-parsear)
    console.log(`📊 Ventas totales: ${this.ventasData.length}`)
    console.log(`📊 Compras totales: ${this.comprasData.length}`)
    
    // Validar que hay datos para procesar
    if (this.ventasData.length === 0 && this.comprasData.length === 0) {
      throw new Error('No se encontraron datos válidos en los archivos de ventas y compras')
    }

    // 2. Filtrar solo las no conciliadas
    const ventasPendientes = this.ventasData.filter(v => !this.conciliadasVentas.has(v.id))
    const comprasPendientes = this.comprasData.filter(c => !this.conciliadasCompras.has(c.id))
    
    console.log(`📊 Ventas pendientes: ${ventasPendientes.length}`)
    console.log(`📊 Compras pendientes: ${comprasPendientes.length}`)

    // 3. Si no hay transacciones pendientes, retornar resultado especial
    if (ventasPendientes.length === 0 && comprasPendientes.length === 0) {
      console.log(`⚠️ No hay transacciones pendientes para ${bankName}`)
      
      // Registrar el paso sin conciliaciones
      const step: BankProcessingStep = {
        bankName,
        processedAt: new Date(),
        matchedCount: 0,
        pendingCount: 0,
        totalVentas: this.ventasData.length,
        totalCompras: this.comprasData.length,
        ventasConciliadas: 0,
        comprasConciliadas: 0
      }
      
      this.processingSteps.push(step)
      
      // Retornar resultado especial indicando que no hay pendientes
      return [{
        id: `no-pending-${Date.now()}`,
        extractoItem: {
          id: 'no-pending',
          banco: bankName,
          cuenta: 'N/A',
          fechaOperacion: new Date(),
          concepto: 'No hay transacciones pendientes para conciliar',
          importe: 0,
          saldo: 0
        },
        matchedWith: null,
        score: 0,
        status: 'pending' as const,
        tipo: 'venta' as const,
        reason: 'No hay transacciones pendientes para este banco'
      }]
    }

    // 4. Crear archivos temporales solo con pendientes
    const ventasFileTemp = this.createTempFile(ventasPendientes, 'ventas')
    const comprasFileTemp = this.createTempFile(comprasPendientes, 'compras')

    // 5. Procesar con el motor existente
    const results = await this.engine.processFiles(
      ventasFileTemp,
      comprasFileTemp,
      extractFile,
      options
    )

    // 6. Actualizar estado de conciliadas
    this.updateConciliadas(results)

    // 7. Registrar el paso de procesamiento
    const step: BankProcessingStep = {
      bankName,
      processedAt: new Date(),
      matchedCount: results.filter(r => r.status === 'matched').length,
      pendingCount: results.filter(r => r.status === 'pending').length,
      totalVentas: this.ventasData.length,
      totalCompras: this.comprasData.length,
      ventasConciliadas: results.filter(r => r.status === 'matched' && r.tipo === 'venta').length,
      comprasConciliadas: results.filter(r => r.status === 'matched' && r.tipo === 'compra').length
    }

    this.processingSteps.push(step)

    // 8. Acumular resultados
    const matchedResults = results.filter(r => r.status === 'matched')
    const pendingResults = results.filter(r => r.status === 'pending')
    
    this.allMatched.push(...matchedResults)
    this.allPending.push(...pendingResults)

    // 9. Extraer asientos contables si existen
    this.extractAsientos(results)

    console.log(`✅ Banco ${bankName} procesado:`)
    console.log(`   - Conciliadas: ${step.matchedCount}`)
    console.log(`   - Pendientes: ${step.pendingCount}`)
    console.log(`   - Ventas conciliadas: ${step.ventasConciliadas}`)
    console.log(`   - Compras conciliadas: ${step.comprasConciliadas}`)
    console.log(`📊 Acumulado total:`)
    console.log(`   - Total conciliadas: ${this.allMatched.length}`)
    console.log(`   - Total pendientes: ${this.allPending.length}`)
    console.log(`   - Ventas ya conciliadas: ${this.conciliadasVentas.size}`)
    console.log(`   - Compras ya conciliadas: ${this.conciliadasCompras.size}`)

    return results
  }

  /**
   * Actualiza el estado de transacciones ya conciliadas
   */
  private updateConciliadas(results: MatchResult[]): void {
    results.forEach(result => {
      if (result.status === 'matched' && result.matchedWith) {
        if (result.tipo === 'venta') {
          this.conciliadasVentas.add(result.matchedWith.id)
        } else if (result.tipo === 'compra') {
          this.conciliadasCompras.add(result.matchedWith.id)
        }
      }
    })
  }

  /**
   * Extrae asientos contables de los resultados
   */
  private extractAsientos(_results: MatchResult[]): void {
    // Buscar asientos en los resultados (esto dependería de cómo los retorna el motor)
    // Por ahora, asumimos que no hay asientos en los MatchResult
    // Los asientos se generan por separado en el motor
  }

  /**
   * Genera el resultado final consolidado
   */
  generateFinalResult(): MultiBankResult {
    const totalMatched = this.allMatched.length
    const totalPending = this.allPending.length
    const totalMovimientos = totalMatched + totalPending
    const matchRate = totalMovimientos > 0 ? (totalMatched / totalMovimientos) * 100 : 0

    const result: MultiBankResult = {
      steps: this.processingSteps,
      allMatched: this.allMatched,
      allPending: this.allPending,
      totalMatched,
      totalPending,
      matchRate,
      consolidatedAsientos: this.allAsientos,
      summary: {
        totalBanks: this.processingSteps.length,
        totalMovimientos,
        totalConciliados: totalMatched,
        totalPendientes: totalPending,
        matchRate
      }
    }

    this.printFinalSummary(result)
    return result
  }

  /**
   * Imprime resumen final detallado
   */
  private printFinalSummary(result: MultiBankResult): void {
    console.log('\n' + '='.repeat(80))
    console.log('📊 RESUMEN FINAL DE CONCILIACIÓN MULTI-BANCO')
    console.log('='.repeat(80))
    
    console.log('\n🏦 Bancos Procesados:')
    result.steps.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step.bankName}`)
      console.log(`      - Fecha: ${step.processedAt.toLocaleString()}`)
      console.log(`      - Conciliadas: ${step.matchedCount}`)
      console.log(`      - Pendientes: ${step.pendingCount}`)
      console.log(`      - Ventas conciliadas: ${step.ventasConciliadas}/${step.totalVentas}`)
      console.log(`      - Compras conciliadas: ${step.comprasConciliadas}/${step.totalCompras}`)
    })
    
    console.log('\n📈 Estadísticas Globales:')
    console.log(`   - Total Bancos: ${result.summary.totalBanks}`)
    console.log(`   - Total Movimientos: ${result.summary.totalMovimientos}`)
    console.log(`   - Total Conciliados: ${result.summary.totalConciliados}`)
    console.log(`   - Total Pendientes: ${result.summary.totalPendientes}`)
    console.log(`   - Tasa de Conciliación: ${result.summary.matchRate.toFixed(2)}%`)
    
    console.log('\n💰 Asientos Contables:')
    console.log(`   - Total de asientos: ${result.consolidatedAsientos.length}`)
    
    console.log('\n' + '='.repeat(80))
  }

  /**
   * Crea un archivo temporal a partir de un array de transacciones
   */
  private createTempFile(data: unknown[], type: string): File {
    if (data.length === 0) {
      // Crear un archivo vacío con headers
      const headers = this.getHeadersForType(type)
      const csvContent = headers.join(',')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      return new File([blob], `temp_${type}_empty.csv`, { type: 'text/csv' })
    }

    const csvContent = this.convertToCSV(data)
    const blob = new Blob([csvContent], { type: 'text/csv' })
    return new File([blob], `temp_${type}_${Date.now()}.csv`, { type: 'text/csv' })
  }

  /**
   * Obtiene los headers apropiados para cada tipo
   */
  private getHeadersForType(type: string): string[] {
    if (type === 'ventas') {
      return ['id', 'fecha_emision', 'fecha_cobro', 'medio_cobro', 'moneda', 'neto', 'iva', 'total', 'cuit_cliente', 'cbu_cliente', 'referencia']
    } else if (type === 'compras') {
      return ['id', 'fecha_emision', 'fecha_pago', 'forma_pago', 'moneda', 'neto', 'iva', 'total', 'cuit_proveedor', 'cbu_proveedor', 'orden_pago']
    }
    return []
  }

  /**
   * Convierte un array de objetos a formato CSV
   */
  private convertToCSV(data: unknown[]): string {
    if (data.length === 0) return ''
    
    const firstRow = data[0] as Record<string, unknown>
    const headers = Object.keys(firstRow)
    const csvHeaders = headers.join(',')
    
    const csvRows = data.map(row => {
      const rowData = row as Record<string, unknown>
      return headers.map(header => {
        const value = rowData[header]
        if (value === null || value === undefined) return ''
        
        // Manejar fechas
        if (value instanceof Date) {
          return value.toLocaleDateString('es-AR')
        }
        
        // Escapar comas y comillas en strings
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        
        return String(value)
      }).join(',')
    })
    
    return [csvHeaders, ...csvRows].join('\n')
  }

  /**
   * Parse helpers - usando parsers inteligentes
   */
  private async parseVentas(file: File): Promise<VentaCanon[]> {
    const extension = file.name.split('.').pop()?.toLowerCase()
    console.log(`🔍 PARSING VENTAS INTELIGENTE - Archivo: ${file.name}, Extensión: ${extension}`)
    
    if (extension === 'csv') {
      console.log('📄 Usando parser CSV inteligente para ventas')
      const Papa = await import('papaparse')
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              reject(new Error('Error al parsear CSV de ventas'))
            } else {
              const data = results.data as Record<string, unknown>[]
              const ventas = data.map((item, index) => ({
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
              resolve(ventas)
            }
          },
          error: (error) => reject(error)
        })
      })
    } else if (extension === 'xlsx' || extension === 'xls') {
      console.log('📊 Usando parser Excel inteligente para ventas')
      const buffer = await file.arrayBuffer()
      const ventasData = this.smartVentasComprasParser.parseVentas(buffer)
      
      // Convertir al formato VentaCanon
      return ventasData.map((venta, index) => ({
        id: `venta_${index}`,
        fechaEmision: venta.fecha,
        fechaCobroEstimada: undefined,
        medioCobro: 'Transferencia',
        moneda: 'ARS',
        neto: venta.neto,
        iva: venta.iva,
        total: venta.total,
        cuitCliente: venta.cuitCliente,
        cbuCvuCliente: undefined,
        referenciaExterna: venta.numero
      }))
    } else {
      console.error(`❌ Formato de archivo no soportado: ${extension}`)
      throw new Error(`Formato de archivo no soportado: ${extension}`)
    }
  }

  private async parseCompras(file: File): Promise<CompraCanon[]> {
    const extension = file.name.split('.').pop()?.toLowerCase()
    console.log(`🔍 PARSING COMPRAS INTELIGENTE - Archivo: ${file.name}, Extensión: ${extension}`)
    
    if (extension === 'csv') {
      console.log('📄 Usando parser CSV inteligente para compras')
      const Papa = await import('papaparse')
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              reject(new Error('Error al parsear CSV de compras'))
            } else {
              const data = results.data as Record<string, unknown>[]
              const compras = data.map((item, index) => ({
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
              resolve(compras)
            }
          },
          error: (error) => reject(error)
        })
      })
    } else if (extension === 'xlsx' || extension === 'xls') {
      console.log('📊 Usando parser Excel inteligente para compras')
      const buffer = await file.arrayBuffer()
      const comprasData = this.smartVentasComprasParser.parseCompras(buffer)
      
      // Convertir al formato CompraCanon
      return comprasData.map((compra, index) => ({
        id: `compra_${index}`,
        fechaEmision: compra.fecha,
        fechaPagoEstimada: undefined,
        formaPago: 'Transferencia',
        moneda: 'ARS',
        neto: compra.neto,
        iva: compra.iva,
        total: compra.total,
        cuitProveedor: compra.cuitProveedor,
        cbuCvuProveedor: undefined,
        ordenPago: compra.numero
      }))
    } else {
      throw new Error(`Formato de archivo no soportado: ${extension}`)
    }
  }

  private async parseExcelVentas(file: File): Promise<VentaCanon[]> {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const buffer = await file.arrayBuffer()
    await workbook.xlsx.load(buffer)
    
    const worksheet = workbook.worksheets[0]
    const rows: VentaCanon[] = []
    
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
      
      rows.push({
        id: `venta_${rowNumber - 1}`,
        fechaEmision: this.parseDate(rowData.fecha_emision || rowData.fecha),
        fechaCobroEstimada: rowData.fecha_cobro ? this.parseDate(rowData.fecha_cobro) : undefined,
        medioCobro: String(rowData.medio_cobro || rowData.medio || 'Transferencia'),
        moneda: String(rowData.moneda || 'ARS'),
        neto: parseFloat(String(rowData.neto || rowData.subtotal || 0)),
        iva: rowData.iva ? parseFloat(String(rowData.iva)) : undefined,
        total: parseFloat(String(rowData.total || rowData.monto || 0)),
        cuitCliente: rowData.cuit_cliente ? String(rowData.cuit_cliente) : undefined,
        cbuCvuCliente: rowData.cbu_cliente ? String(rowData.cbu_cliente) : undefined,
        referenciaExterna: rowData.referencia ? String(rowData.referencia) : undefined
      })
    })
    
    return rows
  }

  private async parseExcelCompras(file: File): Promise<CompraCanon[]> {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const buffer = await file.arrayBuffer()
    await workbook.xlsx.load(buffer)
    
    const worksheet = workbook.worksheets[0]
    const rows: CompraCanon[] = []
    
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
      
      rows.push({
        id: `compra_${rowNumber - 1}`,
        fechaEmision: this.parseDate(rowData.fecha_emision || rowData.fecha),
        fechaPagoEstimada: rowData.fecha_pago ? this.parseDate(rowData.fecha_pago) : undefined,
        formaPago: String(rowData.forma_pago || rowData.medio || 'Transferencia'),
        moneda: String(rowData.moneda || 'ARS'),
        neto: parseFloat(String(rowData.neto || rowData.subtotal || 0)),
        iva: rowData.iva ? parseFloat(String(rowData.iva)) : undefined,
        total: parseFloat(String(rowData.total || rowData.monto || 0)),
        cuitProveedor: String(rowData.cuit_proveedor || rowData.cuit),
        cbuCvuProveedor: rowData.cbu_proveedor ? String(rowData.cbu_proveedor) : undefined,
        ordenPago: rowData.orden_pago ? String(rowData.orden_pago) : undefined
      })
    })
    
    return rows
  }

  private parseDate(dateValue: unknown): Date {
    try {
      // Si es null, undefined o string vacío, retornar fecha actual
      if (!dateValue || (typeof dateValue === 'string' && dateValue.trim() === '')) {
        return new Date()
      }
      
      // Si ya es una fecha válida
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? new Date() : dateValue
      }
      
      // Si es string, procesar
      if (typeof dateValue === 'string') {
        const cleanValue = dateValue.trim()
        
        // Si es string DD/MM/YYYY (formato argentino)
        if (cleanValue.includes('/')) {
          const parts = cleanValue.split('/')
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10)
            const month = parseInt(parts[1], 10) - 1  // Restar 1 para índice de mes (0-11)
            const year = parseInt(parts[2], 10)
            
            // Validar rangos - CORREGIDO: month ya está en rango 0-11
            if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
              const date = new Date(year, month, day)
              if (!isNaN(date.getTime())) {
                console.log(`✅ Fecha parseada correctamente: ${cleanValue} -> ${date.toLocaleDateString('es-AR')}`)
                return date
              }
            } else {
              console.warn(`⚠️ Fecha fuera de rango: ${cleanValue} (day: ${day}, month: ${month + 1}, year: ${year})`)
            }
          }
        }
        
        // Si es string YYYY-MM-DD (formato ISO)
        if (cleanValue.includes('-')) {
          const date = new Date(cleanValue)
          if (!isNaN(date.getTime())) {
            console.log(`✅ Fecha ISO parseada: ${cleanValue} -> ${date.toLocaleDateString('es-AR')}`)
            return date
          }
        }
        
        // Intentar parsear como fecha estándar
        const date = new Date(cleanValue)
        if (!isNaN(date.getTime())) {
          console.log(`✅ Fecha estándar parseada: ${cleanValue} -> ${date.toLocaleDateString('es-AR')}`)
          return date
        }
      }
      
      // Si es número (timestamp)
      if (typeof dateValue === 'number') {
        const date = new Date(dateValue)
        if (!isNaN(date.getTime())) {
          return date
        }
      }
      
      // Fallback: fecha actual
      console.warn(`⚠️ No se pudo parsear fecha: ${dateValue}, usando fecha actual`)
      return new Date()
    } catch (error) {
      console.warn('Error parsing date:', dateValue, error)
      return new Date() // Fecha actual como fallback seguro
    }
  }

  /**
   * Obtiene el estado actual del proceso
   */
  getStatus(): {
    stepsCompleted: number
    totalMatched: number
    totalPending: number
    ventasConciliadas: number
    comprasConciliadas: number
    matchRate: number
  } {
    const totalMovimientos = this.allMatched.length + this.allPending.length
    const matchRate = totalMovimientos > 0 ? (this.allMatched.length / totalMovimientos) * 100 : 0
    
    return {
      stepsCompleted: this.processingSteps.length,
      totalMatched: this.allMatched.length,
      totalPending: this.allPending.length,
      ventasConciliadas: this.conciliadasVentas.size,
      comprasConciliadas: this.conciliadasCompras.size,
      matchRate
    }
  }

  /**
   * Resetea el orquestador para un nuevo proceso
   */
  reset(): void {
    this.processingSteps = []
    this.allMatched = []
    this.allPending = []
    this.allAsientos = []
    this.conciliadasVentas.clear()
    this.conciliadasCompras.clear()
    this.ventasFile = null
    this.comprasFile = null
    console.log('🔄 Orquestador multi-banco reseteado')
  }

  /**
   * Obtiene estadísticas por banco
   */
  getBankStats(): BankProcessingStep[] {
    return [...this.processingSteps]
  }
}