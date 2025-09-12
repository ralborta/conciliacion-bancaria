import { VentaCanon, CompraCanon, ExtractoCanon, MatchResult } from '@/lib/types/conciliacion'

interface MatchingCriteria {
  weight: number;
  name: string;
  evaluate: (bankMovement: any, document: any) => number;
}

export class ArgentinaMatchingEngine {
  private criteria: MatchingCriteria[] = [
    // 1. MATCH POR MONTO EXACTO (peso: 35%)
    {
      name: 'MONTO_EXACTO',
      weight: 0.35,
      evaluate: (bank, doc) => {
        const difference = Math.abs(Math.abs(bank.importe) - doc.total);
        const percentage = difference / doc.total;
        if (percentage < 0.001) return 1.0;  // Exacto
        if (percentage < 0.01) return 0.9;   // 1% diferencia
        if (percentage < 0.02) return 0.7;   // 2% diferencia
        if (percentage < 0.05) return 0.5;   // 5% diferencia (retenciones)
        if (percentage < 0.10) return 0.3;   // 10% diferencia
        return 0;
      }
    },

    // 2. MATCH POR MONTO CON RETENCIONES (peso: 25%)
    {
      name: 'MONTO_CON_RETENCIONES',
      weight: 0.25,
      evaluate: (bank, doc) => {
        // PRIMERO: Verificar que las fechas estén cerca (máximo 30 días)
        const daysDiff = Math.abs((bank.fechaOperacion.getTime() - doc.fechaEmision.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) return 0; // Si la fecha está muy lejos, no hacer match
        
        // Calcular posibles retenciones
        const retenciones = {
          IIBB: doc.total * 0.03,        // 3%
          SIRCREB: doc.total * 0.02,     // 2%
          Ganancias: doc.total * 0.02,   // 2%
          IVA: doc.total * 0.01,         // 1%
          IDC: Math.abs(bank.importe) * 0.006  // 0.6% sobre el débito
        };
        
        const totalRetenciones = Object.values(retenciones).reduce((a, b) => a + b, 0);
        const montoConRetenciones = doc.total - totalRetenciones;
        const difference = Math.abs(Math.abs(bank.importe) - montoConRetenciones);
        
        if (difference < doc.total * 0.01) return 1.0;
        if (difference < doc.total * 0.03) return 0.7;
        if (difference < doc.total * 0.05) return 0.4;
        return 0;
      }
    },

    // 3. MATCH POR FECHA (peso: 20%)
    {
      name: 'PROXIMIDAD_FECHA',
      weight: 0.20,
      evaluate: (bank, doc) => {
        const daysDiff = Math.abs((bank.fechaOperacion.getTime() - doc.fechaEmision.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 0) return 1.0;      // Mismo día
        if (daysDiff <= 2) return 0.9;       // 2 días
        if (daysDiff <= 5) return 0.7;       // 5 días (semana laboral)
        if (daysDiff <= 10) return 0.5;      // 10 días
        if (daysDiff <= 30) return 0.3;      // Mes
        if (daysDiff <= 60) return 0.1;      // 2 meses
        return 0;
      }
    },

    // 4. MATCH POR CUIT EN CONCEPTO (peso: 15%)
    {
      name: 'CUIT_EN_CONCEPTO',
      weight: 0.15,
      evaluate: (bank, doc) => {
        const concepto = bank.concepto || '';
        const cuitRegex = /\d{11}/g;
        const cuitsEnConcepto = concepto.match(cuitRegex) || [];
        
        // Buscar CUIT del documento en el concepto
        const docCuit = doc.cuitCliente || doc.cuitProveedor;
        if (docCuit && cuitsEnConcepto.includes(docCuit)) {
          return 1.0;
        }
        
        // Buscar CUIT parcial (últimos 8 dígitos)
        if (docCuit) {
          const cuitParcial = docCuit.slice(-8);
          if (concepto.includes(cuitParcial)) return 0.7;
        }
        
        return 0;
      }
    },

    // 5. MATCH POR NOMBRE EN CONCEPTO (peso: 10%)
    {
      name: 'NOMBRE_EN_CONCEPTO',
      weight: 0.10,
      evaluate: (bank, doc) => {
        const concepto = (bank.concepto || '').toUpperCase();
        const nombre = (doc.cuitCliente || doc.cuitProveedor || '').toUpperCase();
        
        if (!nombre) return 0;
        
        // Extraer nombre del concepto bancario (después de "N:")
        const matchNombre = concepto.match(/N:([^-]+)/);
        if (matchNombre) {
          const nombreEnConcepto = matchNombre[1].trim();
          if (nombreEnConcepto === nombre) return 1.0;
          if (nombreEnConcepto.includes(nombre) || nombre.includes(nombreEnConcepto)) return 0.7;
        }
        
        // Buscar palabras clave del nombre
        const palabrasNombre = nombre.split(' ').filter((p: string) => p.length > 3);
        const palabrasEncontradas = palabrasNombre.filter((p: string) => concepto.includes(p));
        
        return palabrasEncontradas.length / palabrasNombre.length;
      }
    },

    // 6. MATCH POR REFERENCIA (peso: 10%)
    {
      name: 'REFERENCIA',
      weight: 0.10,
      evaluate: (bank, doc) => {
        const concepto = bank.concepto || '';
        
        // Buscar número de factura en concepto
        if (doc.referenciaExterna) {
          if (concepto.includes(doc.referenciaExterna)) return 1.0;
        }
        
        // Buscar código de operación
        const codigoOp = concepto.match(/C\.(\d+)/);
        if (codigoOp && doc.ordenPago === codigoOp[1]) {
          return 1.0;
        }
        
        return 0;
      }
    },

    // 7. MATCH POR TIPO DE OPERACIÓN (peso: 5%)
    {
      name: 'TIPO_OPERACION',
      weight: 0.05,
      evaluate: (bank, doc) => {
        const concepto = (bank.concepto || '').toUpperCase();
        
        // Identificar tipo de operación
        const esTransferencia = concepto.includes('BIP') || concepto.includes('TR') || concepto.includes('TRANSF');
        const esDebito = concepto.includes('DEBITO') || concepto.includes('DB');
        const esPago = concepto.includes('PAGO') || concepto.includes('P.SERV');
        
        // Para compras esperamos débitos/transferencias
        if (doc.tipo === 'COMPRA' && (esTransferencia || esDebito || esPago)) return 1.0;
        
        // Para ventas esperamos créditos
        if (doc.tipo === 'VENTA' && bank.importe > 0) return 1.0;
        
        return 0;
      }
    }
  ];

  // ✅ MEJORA 1: Logging Detallado (AGREGAR PRIMERO - BAJO RIESGO)
  private logConciliationProgress(step: string, data: any): void {
    // Logs deshabilitados para evitar rate limit de Railway
    // console.log(`🔍 [Conciliación] ${step}:`, {
    //   timestamp: new Date().toISOString(),
    //   ...data
    // });
  }

  // MÉTODO PRINCIPAL: Calcular score total
  calculateMatchScore(bankMovement: any, document: any): any {
    let totalScore = 0;
    const details: any = {};
    
    this.criteria.forEach(criterion => {
      const score = criterion.evaluate(bankMovement, document);
      const weightedScore = score * criterion.weight;
      totalScore += weightedScore;
      details[criterion.name] = {
        score,
        weighted: weightedScore
      };
    });
    
    return {
      totalScore,
      details,
      isMatch: totalScore >= 0.7,        // 70% para match automático
      needsReview: totalScore >= 0.5 && totalScore < 0.7  // 50-70% revisión manual
    };
  }

  async processArgentinaMatching(
    ventas: VentaCanon[],
    compras: CompraCanon[],
    extracto: ExtractoCanon[]
  ): Promise<MatchResult[]> {
    // ✅ DEBUG INTENSIVO - Verificar datos de entrada
    this.logConciliationProgress('INICIO', {
      ventas: ventas.length,
      compras: compras.length, 
      extracto: extracto.length,
      totalVentas: ventas.reduce((sum, v) => sum + (v.total || 0), 0),
      totalCompras: compras.reduce((sum, c) => sum + (c.total || 0), 0),
      totalExtractoIngresos: extracto.filter(e => (e.importe || 0) > 0).reduce((sum, e) => sum + (e.importe || 0), 0),
      totalExtractoEgresos: extracto.filter(e => (e.importe || 0) < 0).reduce((sum, e) => sum + Math.abs(e.importe || 0), 0)
    });

    const matches: MatchResult[] = []

    // Preparar documentos con tipo
    const documents = [
      ...compras.map(c => ({ ...c, tipo: 'COMPRA' })),
      ...ventas.map(v => ({ ...v, tipo: 'VENTA' }))
    ];

    // Procesar cada movimiento bancario (SIN LOGS DETALLADOS)
    for (let i = 0; i < extracto.length; i++) {
      const extractoItem = extracto[i];
      let bestMatch: MatchResult | null = null
      let bestScore = 0

      // Buscar el mejor match entre todos los documentos
      for (let j = 0; j < documents.length; j++) {
        const document = documents[j];
        const result = this.calculateMatchScore(extractoItem, document);
        
        if (result.totalScore > bestScore) {
          bestScore = result.totalScore;
          
          bestMatch = {
            id: `match_${extractoItem.id}_${document.id}`,
            extractoItem,
            matchedWith: document,
            score: result.totalScore,
            status: result.isMatch ? 'matched' : result.needsReview ? 'suggested' : 'pending',
            tipo: document.tipo as 'venta' | 'compra',
            reason: this.generateMatchReason(result.details, result.totalScore)
          };
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
        };
      }

      matches.push(bestMatch)
    }

    // Procesar el resto sin debug detallado
    for (let i = 5; i < extracto.length; i++) {
      const extractoItem = extracto[i];
      let bestMatch: MatchResult | null = null
      let bestScore = 0

      for (const document of documents) {
        const result = this.calculateMatchScore(extractoItem, document);
        
        if (result.totalScore > bestScore) {
          bestScore = result.totalScore;
          
          bestMatch = {
            id: `match_${extractoItem.id}_${document.id}`,
            extractoItem,
            matchedWith: document,
            score: result.totalScore,
            status: result.isMatch ? 'matched' : result.needsReview ? 'suggested' : 'pending',
            tipo: document.tipo as 'venta' | 'compra',
            reason: this.generateMatchReason(result.details, result.totalScore)
          };
        }
      }

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

    // ✅ AGREGAR al final del método antes del return
    this.logConciliationProgress('RESULTADO FINAL', {
      totalMatches: matches.length,
      exactMatches: matches.filter(m => m.score >= 0.9).length,
      partialMatches: matches.filter(m => m.score < 0.9 && m.score > 0).length,
      unmatched: matches.filter(m => m.score === 0).length
    });

    return matches
  }

  private generateMatchReason(details: any, totalScore: number): string {
    const reasons = [];
    
    if (details.MONTO_EXACTO?.score > 0.8) reasons.push('Monto exacto');
    if (details.MONTO_CON_RETENCIONES?.score > 0.5) reasons.push('Monto con retenciones');
    if (details.PROXIMIDAD_FECHA?.score > 0.7) reasons.push('Fecha cercana');
    if (details.CUIT_EN_CONCEPTO?.score > 0.5) reasons.push('CUIT coincidente');
    if (details.NOMBRE_EN_CONCEPTO?.score > 0.5) reasons.push('Nombre en concepto');
    if (details.REFERENCIA?.score > 0.5) reasons.push('Referencia coincidente');
    if (details.TIPO_OPERACION?.score > 0.5) reasons.push('Tipo de operación');
    
    return reasons.length > 0 ? reasons.join(', ') : `Coincidencia parcial (${(totalScore * 100).toFixed(1)}%)`;
  }

}


