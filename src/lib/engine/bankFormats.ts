// Configuraciones específicas para bancos argentinos

export const BANCO_PROVINCIA_FORMAT = {
  dateColumn: 0,  // Columna A
  conceptColumn: 1, // Columna B  
  amountColumn: 2,  // Columna C
  dateFormat: 'excel', // Números de Excel
  
  // Patrones de conceptos
  patterns: {
    transfer: /BIP DB TR/,
    cuit: /\d{11}/,
    name: /N:([^-]+)/,
    tax: /IMPUESTO|RETENCION|AFIP/
  }
}

export const AFIP_COMPRAS_FORMAT = {
  dateColumn: 0,
  supplierNameColumn: 8,
  supplierCUITColumn: 7,
  totalColumn: 29,
  netColumn: 24,
  ivaColumn: 28
}

export const AFIP_VENTAS_FORMAT = {
  dateColumn: 0,
  clientNameColumn: 8,
  clientCUITColumn: 7,
  totalColumn: 29,
  netColumn: 24,
  ivaColumn: 28
}

// Función para convertir fechas de Excel a Date
export function excelDateToJSDate(excelDate: number): Date {
  const excelEpoch = new Date(1900, 0, 1)
  const jsDate = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000)
  return jsDate
}

// Función para extraer CUIT del concepto bancario
export function extractCUITFromConcept(concepto: string): string | null {
  const cuitRegex = /\d{11}/g
  const matches = concepto.match(cuitRegex)
  return matches ? matches[0] : null
}

// Función para extraer nombre del proveedor del concepto
export function extractSupplierName(concepto: string): string | null {
  const nameRegex = /N:([^-]+)/
  const match = concepto.match(nameRegex)
  return match ? match[1].trim() : null
}

// Función para detectar si es un pago con retenciones
export function hasRetentions(concepto: string): boolean {
  const retentionPatterns = [
    /IMPUESTO/,
    /RETENCION/,
    /AFIP/,
    /IIBB/,
    /SIRCREB/,
    /GANANCIAS/
  ]
  
  return retentionPatterns.some(pattern => pattern.test(concepto))
}








