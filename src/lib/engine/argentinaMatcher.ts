import { VentaCanon, CompraCanon, ExtractoCanon, MatchResult } from '@/lib/types/conciliacion'

export class ArgentinaMatchingEngine {
  
  async processArgentinaMatching(
    ventas: VentaCanon[],
    compras: CompraCanon[],
    extracto: ExtractoCanon[]
  ): Promise<MatchResult[]> {
    console.log("🚀 INICIANDO MATCHING SIMPLE COMO PYTHON");
    console.log("📊 Datos de entrada:", {
      ventas: ventas.length,
      compras: compras.length, 
      extracto: extracto.length
    });

    const matches: MatchResult[] = []

    // LÓGICA SIMPLE COMO EL PYTHON
    // 1. Separar impuestos del extracto
    const { impuestos, movimientosLimpios } = this.separateImpuestos(extracto);
    console.log("📊 Impuestos separados:", { impuestos: impuestos.length, movimientosLimpios: movimientosLimpios.length });

    // 2. Hacer matching simple de ventas (ingresos)
    const ingresos = movimientosLimpios.filter(m => m.importe > 0);
    console.log("🔄 Procesando ventas:", { ingresos: ingresos.length, ventas: ventas.length });
    
    for (let i = 0; i < ingresos.length; i++) {
      const ingreso = ingresos[i];
      let matched = false;
      
      for (let j = 0; j < ventas.length; j++) {
        const venta = ventas[j];
        
        // Matching simple por concepto (como el Python)
        if (this.simpleMatch(ingreso.concepto, venta.cliente || '')) {
          matches.push({
            id: `venta_match_${i}_${j}`,
            extractoItem: ingreso,
            matchedWith: venta,
            score: 0.9,
            status: 'matched',
            tipo: 'venta',
            reason: 'Match simple por concepto'
          });
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        matches.push({
          id: `venta_pending_${i}`,
          extractoItem: ingreso,
          matchedWith: null,
          score: 0,
          status: 'pending',
          tipo: 'venta',
          reason: 'Sin conciliar'
        });
      }
    }

    // 3. Hacer matching simple de compras (egresos)
    const egresos = movimientosLimpios.filter(m => m.importe < 0);
    console.log("🔄 Procesando compras:", { egresos: egresos.length, compras: compras.length });
    
    for (let i = 0; i < egresos.length; i++) {
      const egreso = egresos[i];
      let matched = false;
      
      for (let j = 0; j < compras.length; j++) {
        const compra = compras[j];
        
        // Matching simple por concepto (como el Python)
        if (this.simpleMatch(egreso.concepto, compra.proveedor || '')) {
          matches.push({
            id: `compra_match_${i}_${j}`,
            extractoItem: egreso,
            matchedWith: compra,
            score: 0.9,
            status: 'matched',
            tipo: 'compra',
            reason: 'Match simple por concepto'
          });
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        matches.push({
          id: `compra_pending_${i}`,
          extractoItem: egreso,
          matchedWith: null,
          score: 0,
          status: 'pending',
          tipo: 'compra',
          reason: 'Sin conciliar'
        });
      }
    }

    console.log("✅ MATCHING SIMPLE COMPLETADO:", {
      totalMatches: matches.length,
      matched: matches.filter(m => m.status === 'matched').length,
      pending: matches.filter(m => m.status === 'pending').length
    });

    return matches;
  }

  // MÉTODO SIMPLE COMO EL PYTHON
  private simpleMatch(concepto: string, nombre: string): boolean {
    if (!concepto || !nombre) return false;
    
    // Normalización idéntica al Python
    const normalize = (text: string) => {
      return text
        .toLowerCase()
        .trim()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '');
    };
    
    const conceptoNorm = normalize(concepto);
    const nombreNorm = normalize(nombre);
    
    // Matching bidireccional como el Python
    return conceptoNorm.includes(nombreNorm) || nombreNorm.includes(conceptoNorm);
  }

  // SEPARAR IMPUESTOS COMO EL PYTHON - VERSIÓN SIMPLE
  private separateImpuestos(extracto: ExtractoCanon[]): { impuestos: any[], movimientosLimpios: ExtractoCanon[] } {
    console.log('🚨 FUNCIÓN SEPARATEIMPUESTOS EJECUTÁNDOSE - Total movimientos:', extracto.length);
    
    const impuestos: any[] = [];
    const movimientosLimpios: ExtractoCanon[] = [];

    const esImpuesto = (concepto: string) => {
      const c = concepto.toLowerCase();
      return c.includes('impuesto') || c.includes('retencion') || 
             c.includes('iibb') || c.includes('ganancias') || 
             c.includes('comision') || c.includes('ley 25413') ||
             c.includes('bip db') || c.includes('daynet') ||
             c.includes('transferencia');
    };

    extracto.forEach((mov, index) => {
      // Obtener el concepto original del extracto
      const conceptoOriginal = mov.concepto || '';
      
      console.log(`🔍 Movimiento ${index}: "${conceptoOriginal}"`);
      
      if (esImpuesto(conceptoOriginal)) {
        console.log(`✅ ES IMPUESTO: "${conceptoOriginal}"`);
        
        // Crear objeto preservando el concepto original
        const impuestoConDetalles = {
          ...mov,
          concepto: conceptoOriginal,
          descripcion: conceptoOriginal,
          tipoImpuesto: conceptoOriginal // Usar el concepto original como tipo por ahora
        };
        
        impuestos.push(impuestoConDetalles);
      } else {
        movimientosLimpios.push(mov);
      }
    });

    console.log('📊 RESULTADO:', { impuestos: impuestos.length, movimientosLimpios: movimientosLimpios.length });
    
    return { impuestos, movimientosLimpios };
  }

}