import { VentaCanon, CompraCanon, ExtractoCanon, MatchResult } from '@/lib/types/conciliacion'

export class ArgentinaMatchingEngine {
  private retenciones = {
    IIBB: 0.03,      // 3% Ingresos Brutos
    SIRCREB: 0.02,   // 2% SIRCREB
    Ganancias: 0.02, // 2% Ganancias
    IVA: 0.01        // 1% IVA
  }

  private maxDaysDifference = 30
  private amountTolerance = 0.02 // 2%

  async processArgentinaMatching(
    ventas: VentaCanon[],
    compras: CompraCanon[],
    extracto: ExtractoCanon[]
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = []

    for (const extractoItem of extracto) {
      let bestMatch: MatchResult | null = null
      let bestScore = 0

      // 1. MATCHING POR PAGOS PARCIALES (Compras)
      const partialMatches = await this.matchPartialPayments(extractoItem, compras)
      if (partialMatches.length > 0) {
        const bestPartial = partialMatches[0]
        if (bestPartial.score > bestScore) {
          bestScore = bestPartial.score
          bestMatch = bestPartial
        }
      }

      // 2. MATCHING POR CUIT EN CONCEPTO
      const cuitMatches = await this.matchByCUIT(extractoItem, compras, ventas)
      if (cuitMatches.length > 0) {
        const bestCuit = cuitMatches[0]
        if (bestCuit.score > bestScore) {
          bestScore = bestCuit.score
          bestMatch = bestCuit
        }
      }

      // 3. MATCHING CON RETENCIONES
      const retentionMatches = await this.matchWithRetentions(extractoItem, compras, ventas)
      if (retentionMatches.length > 0) {
        const bestRetention = retentionMatches[0]
        if (bestRetention.score > bestScore) {
          bestScore = bestRetention.score
          bestMatch = bestRetention
        }
      }

      // 4. MATCHING TRADICIONAL (como fallback)
      const traditionalMatches = await this.matchTraditional(extractoItem, compras, ventas)
      if (traditionalMatches.length > 0) {
        const bestTraditional = traditionalMatches[0]
        if (bestTraditional.score > bestScore) {
          bestScore = bestTraditional.score
          bestMatch = bestTraditional
        }
      }

      // Si no hay match, marcar como pendiente
      if (!bestMatch) {
        bestMatch = {
          id: `match_${extractoItem.id}`,
          extractoItem,
          matchedWith: null,
          score: 0,
          status: 'pending',
          reason: 'No se encontró coincidencia con reglas argentinas'
        }
      }

      matches.push(bestMatch)
    }

    return matches
  }

  // 1. MATCHING POR PAGOS PARCIALES
  private async matchPartialPayments(
    extractoItem: ExtractoCanon,
    compras: CompraCanon[]
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = []
    const extractoAmount = Math.abs(extractoItem.importe)
    const extractoDate = extractoItem.fechaOperacion

    for (const compra of compras) {
      const compraAmount = compra.total
      const compraDate = compra.fechaEmision
      
      // Verificar si es un pago parcial (entre 10% y 100% del total)
      const percentage = extractoAmount / compraAmount
      if (percentage >= 0.1 && percentage <= 1.0) {
        
        // Verificar diferencia de fechas (hasta 30 días)
        const daysDiff = Math.abs(extractoDate.getTime() - compraDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysDiff <= this.maxDaysDifference) {
          
          // Calcular score basado en porcentaje y fecha
          let score = 0.5 // Base score para pago parcial
          
          // Mejor score si es pago completo
          if (percentage >= 0.95) score += 0.3
          else if (percentage >= 0.8) score += 0.2
          else if (percentage >= 0.5) score += 0.1
          
          // Mejor score si la fecha es cercana
          if (daysDiff <= 1) score += 0.2
          else if (daysDiff <= 7) score += 0.1
          else if (daysDiff <= 15) score += 0.05

          matches.push({
            id: `partial_${extractoItem.id}_${compra.id}`,
            extractoItem,
            matchedWith: compra,
            score,
            status: score >= 0.8 ? 'matched' : 'suggested',
            tipo: 'compra',
            reason: `Pago parcial del ${Math.round(percentage * 100)}% (${daysDiff.toFixed(0)} días de diferencia)`
          })
        }
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  // 2. MATCHING POR CUIT EN CONCEPTO
  private async matchByCUIT(
    extractoItem: ExtractoCanon,
    compras: CompraCanon[],
    ventas: VentaCanon[]
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = []
    
    // Extraer CUIT del concepto bancario
    const cuitRegex = /\d{11}/g
    const cuitMatches = extractoItem.concepto.match(cuitRegex)
    
    if (cuitMatches) {
      const cuit = cuitMatches[0]
      
      // Buscar en compras
      const compraMatch = compras.find(compra => compra.cuitProveedor === cuit)
      if (compraMatch) {
        const score = this.calculateCUITScore(extractoItem, compraMatch)
        matches.push({
          id: `cuit_${extractoItem.id}_${compraMatch.id}`,
          extractoItem,
          matchedWith: compraMatch,
          score,
          status: score >= 0.8 ? 'matched' : 'suggested',
          tipo: 'compra',
          reason: `CUIT coincidente: ${cuit}`
        })
      }

      // Buscar en ventas
      const ventaMatch = ventas.find(venta => venta.cuitCliente === cuit)
      if (ventaMatch) {
        const score = this.calculateCUITScore(extractoItem, ventaMatch)
        matches.push({
          id: `cuit_${extractoItem.id}_${ventaMatch.id}`,
          extractoItem,
          matchedWith: ventaMatch,
          score,
          status: score >= 0.8 ? 'matched' : 'suggested',
          tipo: 'venta',
          reason: `CUIT coincidente: ${cuit}`
        })
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  // 3. MATCHING CON RETENCIONES
  private async matchWithRetentions(
    extractoItem: ExtractoCanon,
    compras: CompraCanon[],
    ventas: VentaCanon[]
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = []
    const extractoAmount = Math.abs(extractoItem.importe)
    const extractoDate = extractoItem.fechaOperacion

    // Buscar en compras
    for (const compra of compras) {
      const compraAmount = compra.total
      const compraDate = compra.fechaEmision
      
      // Calcular monto con retenciones
      const totalRetentions = compraAmount * (this.retenciones.IIBB + this.retenciones.SIRCREB + this.retenciones.Ganancias)
      const netAmount = compraAmount - totalRetentions
      
      // Verificar si el pago coincide con el monto neto
      const amountDiff = Math.abs(extractoAmount - netAmount)
      const tolerance = compraAmount * this.amountTolerance
      
      if (amountDiff <= tolerance) {
        const daysDiff = Math.abs(extractoDate.getTime() - compraDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysDiff <= this.maxDaysDifference) {
          let score = 0.7 // Base score para matching con retenciones
          
          // Mejor score si la diferencia es menor
          if (amountDiff <= compraAmount * 0.01) score += 0.2
          else if (amountDiff <= compraAmount * 0.02) score += 0.1
          
          // Mejor score si la fecha es cercana
          if (daysDiff <= 1) score += 0.1

          matches.push({
            id: `retention_${extractoItem.id}_${compra.id}`,
            extractoItem,
            matchedWith: compra,
            score,
            status: score >= 0.8 ? 'matched' : 'suggested',
            tipo: 'compra',
            reason: `Monto con retenciones: ${Math.round(totalRetentions)} de retenciones aplicadas`
          })
        }
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  // 4. MATCHING TRADICIONAL (fallback)
  private async matchTraditional(
    extractoItem: ExtractoCanon,
    compras: CompraCanon[],
    ventas: VentaCanon[]
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = []
    const extractoAmount = Math.abs(extractoItem.importe)
    const extractoDate = extractoItem.fechaOperacion

    // Buscar en compras
    for (const compra of compras) {
      const compraAmount = compra.total
      const compraDate = compra.fechaEmision
      
      const amountDiff = Math.abs(extractoAmount - compraAmount)
      const tolerance = compraAmount * this.amountTolerance
      
      if (amountDiff <= tolerance) {
        const daysDiff = Math.abs(extractoDate.getTime() - compraDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysDiff <= 7) { // Ventana más pequeña para matching tradicional
          let score = 0.6 // Base score más bajo para matching tradicional
          
          if (amountDiff <= compraAmount * 0.01) score += 0.3
          if (daysDiff <= 1) score += 0.1

          matches.push({
            id: `traditional_${extractoItem.id}_${compra.id}`,
            extractoItem,
            matchedWith: compra,
            score,
            status: score >= 0.8 ? 'matched' : 'suggested',
            tipo: 'compra',
            reason: 'Coincidencia tradicional'
          })
        }
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  private calculateCUITScore(extractoItem: ExtractoCanon, item: VentaCanon | CompraCanon): number {
    let score = 0.8 // Base score alto para CUIT match
    
    // Verificar diferencia de fechas
    const daysDiff = Math.abs(extractoItem.fechaOperacion.getTime() - item.fechaEmision.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff <= 1) score += 0.2
    else if (daysDiff <= 7) score += 0.1
    
    return Math.min(score, 1.0)
  }
}


