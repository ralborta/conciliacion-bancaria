export interface VentaCanon {
  id: string
  fechaEmision: Date
  fechaCobroEstimada?: Date
  medioCobro: string
  moneda: string
  neto: number
  iva?: number
  total: number
  cliente?: string
  cuitCliente?: string
  cbuCvuCliente?: string
  referenciaExterna?: string
}

export interface CompraCanon {
  id: string
  fechaEmision: Date
  fechaPagoEstimada?: Date
  formaPago: string
  moneda: string
  neto: number
  iva?: number
  total: number
  proveedor?: string
  cuitProveedor: string
  cbuCvuProveedor?: string
  ordenPago?: string
}

export interface ExtractoCanon {
  id: string
  banco: string
  cuenta: string
  fechaOperacion: Date
  fechaValor?: Date
  concepto: string
  importe: number
  saldo?: number
  cuitContraparte?: string
  cbuCvuContraparte?: string
  referencia?: string
}

export interface MatchResult {
  id: string
  extractoItem: ExtractoCanon
  matchedWith: VentaCanon | CompraCanon | null
  score: number
  status: 'matched' | 'suggested' | 'pending' | 'error'
  reason?: string
  tipo?: 'venta' | 'compra'
}

export interface ProcessOptions {
  banco: string
  periodo: string
  rules?: MatchingRules
}

export interface MatchingRules {
  exactMatch: boolean
  fuzzyMatch: boolean
  dateTolerance: number // días
  amountTolerance: number // porcentaje
  cbuMatch: boolean
  cuitMatch: boolean
}

export interface UploadedFile {
  file: File
  type: 'ventas' | 'compras' | 'extracto'
  name: string
  size: number
}

export interface ProcessingStep {
  id: string
  name: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
}

export interface ConciliationStats {
  totalMovimientos: number
  conciliados: number
  pendientes: number
  montoTotal: number
  porcentajeConciliacion: number
}

// ✨ NUEVOS TIPOS PARA ASIENTOS CONTABLES
export interface AsientoContable {
  id: string;
  fecha: string;
  concepto: string;
  circuitoContable: string;
  cuenta: string;
  debe: number;
  haber: number;
  organizacion?: string;
  centroCosto?: string;
  descripcion?: string;
}

export interface AsientosResumen {
  totalAsientos: number;
  totalDebe: number;
  totalHaber: number;
  diferencia: number;
  balanceado: boolean;
  asientosPorTipo: {
    [key: string]: {
      cantidad: number;
      totalDebe: number;
      totalHaber: number;
    };
  };
}

export interface BancoConfig {
  id: string
  nombre: string
  formatos: string[]
  campos: {
    fecha: string
    concepto: string
    importe: string
    referencia: string
    cuit: string
    cbu: string
  }
}

export const BANCOS: BancoConfig[] = [
  {
    id: 'santander',
    nombre: 'Santander',
    formatos: ['.csv', '.xlsx'],
    campos: {
      fecha: 'fecha_operacion',
      concepto: 'concepto',
      importe: 'importe',
      referencia: 'referencia',
      cuit: 'cuit_contraparte',
      cbu: 'cbu_contraparte'
    }
  },
  {
    id: 'bbva',
    nombre: 'BBVA',
    formatos: ['.csv', '.xlsx'],
    campos: {
      fecha: 'fecha',
      concepto: 'descripcion',
      importe: 'monto',
      referencia: 'ref',
      cuit: 'cuit',
      cbu: 'cbu'
    }
  },
  {
    id: 'galicia',
    nombre: 'Galicia',
    formatos: ['.csv', '.xlsx'],
    campos: {
      fecha: 'fecha_op',
      concepto: 'concepto',
      importe: 'importe',
      referencia: 'referencia',
      cuit: 'cuit',
      cbu: 'cbu'
    }
  },
  {
    id: 'icbc',
    nombre: 'ICBC',
    formatos: ['.csv', '.xlsx'],
    campos: {
      fecha: 'fecha_operacion',
      concepto: 'concepto',
      importe: 'importe',
      referencia: 'referencia',
      cuit: 'cuit_contraparte',
      cbu: 'cbu_contraparte'
    }
  },
  {
    id: 'macro',
    nombre: 'Macro',
    formatos: ['.csv', '.xlsx'],
    campos: {
      fecha: 'fecha',
      concepto: 'concepto',
      importe: 'importe',
      referencia: 'referencia',
      cuit: 'cuit',
      cbu: 'cbu'
    }
  },
  {
    id: 'hsbc',
    nombre: 'HSBC',
    formatos: ['.csv', '.xlsx'],
    campos: {
      fecha: 'fecha_operacion',
      concepto: 'concepto',
      importe: 'importe',
      referencia: 'referencia',
      cuit: 'cuit',
      cbu: 'cbu'
    }
  }
]


