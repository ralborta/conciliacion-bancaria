import { AsientoContable, AsientosResumen } from '../types/conciliacion';

export class AsientosGenerator {
  
  static generateAsientosContables(
    impuestos: any[],
    banco: string,
    periodo: string
  ): { asientos: AsientoContable[], resumen: AsientosResumen } {
    
    const asientos: AsientoContable[] = [];
    const fecha = this.formatPeriodoToDate(periodo);
    const conceptoBase = `${banco} ${periodo}`;
    
    console.log("🏦 GENERANDO ASIENTOS CONTABLES:", {
      impuestos: impuestos.length,
      banco,
      periodo,
      fecha
    });
    
    // 1. IMPUESTO LEY 25413 - CRÉDITOS
    const creditos25413 = impuestos.filter(i => 
      i.concepto?.toLowerCase().includes('credito') && 
      i.concepto?.toLowerCase().includes('25413')
    );
    
    if (creditos25413.length > 0) {
      const totalCreditos = creditos25413.reduce((sum, item) => sum + Math.abs(item.importe || 0), 0);
      asientos.push({
        id: `credito_25413_${Date.now()}`,
        fecha,
        concepto: conceptoBase,
        circuitoContable: 'default',
        cuenta: 'Credito Impuesto Ley 25413',
        debe: totalCreditos,
        haber: 0,
        descripcion: `Crédito impuesto débitos y créditos bancarios - ${creditos25413.length} movimientos`
      });
    }

    // 2. IMPUESTO LEY 25413 - DÉBITOS
    const debitos25413 = impuestos.filter(i => 
      i.concepto?.toLowerCase().includes('debito') && 
      i.concepto?.toLowerCase().includes('25413')
    );
    
    if (debitos25413.length > 0) {
      const totalDebitos = debitos25413.reduce((sum, item) => sum + Math.abs(item.importe || 0), 0);
      asientos.push({
        id: `debito_25413_${Date.now()}`,
        fecha,
        concepto: conceptoBase,
        circuitoContable: 'default',
        cuenta: 'Debito Impuesto Ley 25413',
        debe: 0,
        haber: totalDebitos,
        descripcion: `Débito impuesto débitos y créditos bancarios - ${debitos25413.length} movimientos`
      });
    }

    // 3. PERCEPCIONES IVA
    const percepcionesIVA = impuestos.filter(i => 
      i.concepto?.toLowerCase().includes('percepcion') && 
      i.concepto?.toLowerCase().includes('iva')
    );
    
    if (percepcionesIVA.length > 0) {
      const totalPercepcionesIVA = percepcionesIVA.reduce((sum, item) => sum + Math.abs(item.importe || 0), 0);
      asientos.push({
        id: `percepciones_iva_${Date.now()}`,
        fecha,
        concepto: conceptoBase,
        circuitoContable: 'default',
        cuenta: 'Percepciones IVA',
        debe: totalPercepcionesIVA,
        haber: 0,
        descripcion: `Percepciones IVA sufridas - ${percepcionesIVA.length} movimientos`
      });
    }

    // 4. PERCEPCIONES IIBB
    const percepcionesIIBB = impuestos.filter(i => 
      (i.concepto?.toLowerCase().includes('iibb') || 
       i.concepto?.toLowerCase().includes('ingresos brutos')) &&
      i.concepto?.toLowerCase().includes('percep')
    );
    
    if (percepcionesIIBB.length > 0) {
      const totalPercepcionesIIBB = percepcionesIIBB.reduce((sum, item) => sum + Math.abs(item.importe || 0), 0);
      asientos.push({
        id: `percepciones_iibb_${Date.now()}`,
        fecha,
        concepto: conceptoBase,
        circuitoContable: 'default',
        cuenta: 'IIBB Percepciones',
        debe: totalPercepcionesIIBB,
        haber: 0,
        descripcion: `Percepciones IIBB sufridas - ${percepcionesIIBB.length} movimientos`
      });
    }

    // 5. SIRCREB
    const sircreb = impuestos.filter(i => 
      i.concepto?.toLowerCase().includes('sircreb')
    );
    
    if (sircreb.length > 0) {
      const totalSircreb = sircreb.reduce((sum, item) => sum + Math.abs(item.importe || 0), 0);
      if (totalSircreb > 0) {
        asientos.push({
          id: `sircreb_${Date.now()}`,
          fecha,
          concepto: conceptoBase,
          circuitoContable: 'default',
          cuenta: 'SIRCREB',
          debe: totalSircreb,
          haber: 0,
          descripcion: `SIRCREB - ${sircreb.length} movimientos`
        });
      }
    }

    // 6. OTROS IMPUESTOS, TASAS Y CONTRIBUCIONES
    const otrosImpuestos = impuestos.filter(i => 
      i.concepto?.toLowerCase().includes('impuesto') ||
      i.concepto?.toLowerCase().includes('tasa') ||
      i.concepto?.toLowerCase().includes('contribucion')
    ).filter(i => 
      !i.concepto?.toLowerCase().includes('25413') &&
      !i.concepto?.toLowerCase().includes('iva') &&
      !i.concepto?.toLowerCase().includes('iibb') &&
      !i.concepto?.toLowerCase().includes('sircreb')
    );
    
    if (otrosImpuestos.length > 0) {
      const totalOtros = otrosImpuestos.reduce((sum, item) => sum + Math.abs(item.importe || 0), 0);
      if (totalOtros > 0) {
        asientos.push({
          id: `otros_impuestos_${Date.now()}`,
          fecha,
          concepto: conceptoBase,
          circuitoContable: 'default',
          cuenta: 'Impuestos, Tasas y Contribuciones',
          debe: totalOtros,
          haber: 0,
          descripcion: `Otros impuestos y tasas - ${otrosImpuestos.length} movimientos`
        });
      }
    }

    // 7. INTERESES Y GASTOS BANCARIOS
    const gastosBancarios = impuestos.filter(i => 
      i.concepto?.toLowerCase().includes('interes') ||
      i.concepto?.toLowerCase().includes('gasto') ||
      i.concepto?.toLowerCase().includes('comision')
    );
    
    if (gastosBancarios.length > 0) {
      const totalGastos = gastosBancarios.reduce((sum, item) => sum + Math.abs(item.importe || 0), 0);
      if (totalGastos > 0) {
        asientos.push({
          id: `gastos_bancarios_${Date.now()}`,
          fecha,
          concepto: conceptoBase,
          circuitoContable: 'default',
          cuenta: 'Intereses y Gastos Bancarios',
          debe: totalGastos,
          haber: 0,
          descripcion: `Intereses y gastos bancarios - ${gastosBancarios.length} movimientos`
        });
      }
    }

    // 8. CONTRAPARTIDA - BANCO
    const totalDebe = asientos.reduce((sum, a) => sum + a.debe, 0);
    const totalHaber = asientos.reduce((sum, a) => sum + a.haber, 0);
    const diferencia = totalDebe - totalHaber;
    
    if (Math.abs(diferencia) > 0.01) { // Evitar diferencias por redondeo
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

    // Generar resumen
    const resumen = this.generateResumen(asientos);
    
    console.log("✅ ASIENTOS GENERADOS:", {
      totalAsientos: asientos.length,
      totalDebe: resumen.totalDebe,
      totalHaber: resumen.totalHaber,
      balanceado: resumen.balanceado
    });
    
    return { asientos, resumen };
  }

  private static generateResumen(asientos: AsientoContable[]): AsientosResumen {
    const totalDebe = asientos.reduce((sum, a) => sum + a.debe, 0);
    const totalHaber = asientos.reduce((sum, a) => sum + a.haber, 0);
    const diferencia = Math.abs(totalDebe - totalHaber);
    
    // Agrupar por tipo de cuenta
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
      balanceado: diferencia < 0.01, // Tolerancia para redondeo
      asientosPorTipo
    };
  }

  private static formatPeriodoToDate(periodo: string): string {
    // Convertir "04-24" a "30/04/2024" (último día del mes)
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
