import { AsientoContable, AsientosResumen } from '../types/conciliacion';

export class AsientosGenerator {
  
  static generateAsientosContables(
    impuestos: any[],
    banco: string,
    periodo: string
  ): { asientos: AsientoContable[], resumen: AsientosResumen } {
    
    console.log('🔍 AsientosGenerator - Iniciando con', impuestos.length, 'impuestos');
    console.log('🔍 Primer impuesto ejemplo:', impuestos[0]);
    
    const asientos: AsientoContable[] = [];
    const fecha = this.formatPeriodoToDate(periodo);
    const conceptoBase = `${banco} ${periodo}`;
    
    // DEBUGGING: Ver todos los conceptos únicos
    const conceptosUnicos = [...new Set(impuestos.map(i => i.concepto || i.descripcion || i.tipo || 'Sin concepto'))];
    console.log('🔍 Conceptos únicos encontrados:', conceptosUnicos);
    
    // 1. AGRUPAR TODOS LOS IMPUESTOS BANCARIOS COMO UNO SOLO POR AHORA
    // (Después refinamos la clasificación)
    
    const todosLosImpuestos = impuestos.filter(i => i.importe && Math.abs(i.importe) > 0);
    console.log('🔍 Impuestos con importe válido:', todosLosImpuestos.length);
    
    if (todosLosImpuestos.length === 0) {
      console.log('⚠️ No hay impuestos con importes válidos');
      return { asientos: [], resumen: this.generateResumen([]) };
    }
    
    // CLASIFICAR POR TIPO DE IMPUESTO BASADO EN LOS DATOS REALES
    const clasificados = this.clasificarImpuestos(todosLosImpuestos);
    console.log('🔍 Impuestos clasificados:', clasificados);
    
    // GENERAR ASIENTOS POR CADA CLASIFICACIÓN
    Object.entries(clasificados).forEach(([tipo, impuestosDelTipo]) => {
      if (impuestosDelTipo.length > 0) {
        const totalImporte = impuestosDelTipo.reduce((sum, imp) => sum + Math.abs(imp.importe || 0), 0);
        
        if (totalImporte > 0) {
          console.log(`✅ Generando asiento para ${tipo}: $${totalImporte}`);
          
          asientos.push({
            id: `${tipo.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
            fecha,
            concepto: conceptoBase,
            circuitoContable: 'default',
            cuenta: this.getCuentaContable(tipo),
            debe: totalImporte,
            haber: 0,
            descripcion: `${tipo} - ${impuestosDelTipo.length} movimientos`
          });
        }
      }
    });
    
    // CONTRAPARTIDA BANCARIA
    const totalDebe = asientos.reduce((sum, a) => sum + a.debe, 0);
    const totalHaber = asientos.reduce((sum, a) => sum + a.haber, 0);
    const diferencia = totalDebe - totalHaber;
    
    if (Math.abs(diferencia) > 0.01) {
      asientos.push({
        id: `banco_contrapartida_${Date.now()}`,
        fecha,
        concepto: conceptoBase,
        circuitoContable: 'default',
        cuenta: `Bco. ${banco} Cta. Cte.`,
        debe: diferencia < 0 ? Math.abs(diferencia) : 0,
        haber: diferencia > 0 ? diferencia : 0,
        descripcion: `Contrapartida bancaria - movimientos de impuestos`
      });
    }
    
    console.log('✅ Asientos generados:', asientos.length);
    const resumen = this.generateResumen(asientos);
    
    return { asientos, resumen };
  }
  
  private static clasificarImpuestos(impuestos: any[]): { [key: string]: any[] } {
    const clasificados: { [key: string]: any[] } = {
      'Impuesto Ley 25413 - Créditos': [],
      'Impuesto Ley 25413 - Débitos': [],
      'Percepciones IVA': [],
      'Percepciones IIBB': [],
      'SIRCREB': [],
      'Retenciones Ganancias': [],
      'Retenciones IVA': [],
      'Comisiones y Gastos Bancarios': [],
      'Otros Impuestos': []
    };
    
    impuestos.forEach(impuesto => {
      const concepto = (impuesto.concepto || impuesto.descripcion || impuesto.tipo || '').toLowerCase();
      const importe = impuesto.importe || 0;
      
      console.log(`🔍 Clasificando: "${concepto}" - Importe: ${importe}`);
      
      // CLASIFICACIÓN MEJORADA BASADA EN PATRONES COMUNES
      if (concepto.includes('25413') || concepto.includes('credito') || concepto.includes('débito')) {
        if (importe > 0) {
          clasificados['Impuesto Ley 25413 - Créditos'].push(impuesto);
        } else {
          clasificados['Impuesto Ley 25413 - Débitos'].push(impuesto);
        }
      } else if (concepto.includes('percep') && concepto.includes('iva')) {
        clasificados['Percepciones IVA'].push(impuesto);
      } else if (concepto.includes('percep') && (concepto.includes('iibb') || concepto.includes('ingresos brutos'))) {
        clasificados['Percepciones IIBB'].push(impuesto);
      } else if (concepto.includes('sircreb')) {
        clasificados['SIRCREB'].push(impuesto);
      } else if (concepto.includes('reten') && concepto.includes('ganancia')) {
        clasificados['Retenciones Ganancias'].push(impuesto);
      } else if (concepto.includes('reten') && concepto.includes('iva')) {
        clasificados['Retenciones IVA'].push(impuesto);
      } else if (concepto.includes('comision') || concepto.includes('gasto') || concepto.includes('interes') || concepto.includes('bancario')) {
        clasificados['Comisiones y Gastos Bancarios'].push(impuesto);
      } else {
        // Si no coincide con ningún patrón específico, va a "Otros"
        clasificados['Otros Impuestos'].push(impuesto);
      }
    });
    
    return clasificados;
  }
  
  private static getCuentaContable(tipoImpuesto: string): string {
    const cuentas: { [key: string]: string } = {
      'Impuesto Ley 25413 - Créditos': 'Crédito Impuesto Ley 25413',
      'Impuesto Ley 25413 - Débitos': 'Débito Impuesto Ley 25413',
      'Percepciones IVA': 'Percepciones IVA',
      'Percepciones IIBB': 'IIBB Percepciones',
      'SIRCREB': 'SIRCREB',
      'Retenciones Ganancias': 'Retenciones Ganancias Sufridas',
      'Retenciones IVA': 'Retenciones IVA Sufridas',
      'Comisiones y Gastos Bancarios': 'Intereses y Gastos Bancarios',
      'Otros Impuestos': 'Impuestos, Tasas y Contribuciones'
    };
    
    return cuentas[tipoImpuesto] || 'Otros Impuestos';
  }

  private static generateResumen(asientos: AsientoContable[]): AsientosResumen {
    const totalDebe = asientos.reduce((sum, a) => sum + a.debe, 0);
    const totalHaber = asientos.reduce((sum, a) => sum + a.haber, 0);
    const diferencia = Math.abs(totalDebe - totalHaber);
    
    const asientosPorTipo: { [key: string]: { cantidad: number; totalDebe: number; totalHaber: number } } = {};
    
    asientos.forEach(asiento => {
      const tipo = asiento.cuenta;
      if (!asientosPorTipo[tipo]) {
        asientosPorTipo[tipo] = { cantidad: 0, totalDebe: 0, totalHaber: 0 };
      }
      asientosPorTipo[tipo].cantidad++;
      asientosPorTipo[tipo].totalDebe += asiento.debe;
      asientosPorTipo[tipo].totalHaber += asiento.haber;
    });

    return {
      totalAsientos: asientos.length,
      totalDebe,
      totalHaber,
      diferencia,
      balanceado: diferencia < 0.01,
      asientosPorTipo
    };
  }

  private static formatPeriodoToDate(periodo: string): string {
    try {
      const [month, year] = periodo.split('-');
      const fullYear = `20${year}`;
      const lastDay = new Date(parseInt(fullYear), parseInt(month), 0).getDate();
      return `${lastDay}/${month}/${fullYear}`;
    } catch {
      return new Date().toLocaleDateString('es-AR');
    }
  }
}