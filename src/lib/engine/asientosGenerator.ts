import { AsientoContable, AsientosResumen } from '../types/conciliacion';

export class AsientosGenerator {
  
  static generateAsientosContables(
    impuestos: any[],
    banco: string,
    periodo: string
  ): { asientos: AsientoContable[], resumen: AsientosResumen } {
    
    console.log('🔍 AsientosGenerator - Recibiendo', impuestos.length, 'impuestos estructurados');
    
    const asientos: AsientoContable[] = [];
    const fecha = this.formatPeriodoToDate(periodo);
    const conceptoBase = `${banco} ${periodo}`;
    
    if (impuestos.length === 0) {
      console.log('⚠️ No hay impuestos para procesar');
      return { asientos: [], resumen: this.generateResumen([]) };
    }

    // 🎯 MOSTRAR PRIMER IMPUESTO PARA VERIFICAR ESTRUCTURA
    console.log('🔍 Primer impuesto recibido:', JSON.stringify(impuestos[0], null, 2));

    // 🏷️ AGRUPAR POR TIPO DE IMPUESTO (usando la nueva clasificación)
    const agrupados = this.agruparPorTipo(impuestos);
    console.log('📊 Impuestos agrupados:', Object.keys(agrupados));

    // 🧾 GENERAR ASIENTOS POR CADA GRUPO
    Object.entries(agrupados).forEach(([tipo, impuestosDelTipo]) => {
      if (impuestosDelTipo.length > 0) {
        this.generarAsientoPorTipo(tipo, impuestosDelTipo, fecha, conceptoBase, asientos);
      }
    });

    // 🏦 CONTRAPARTIDA BANCARIA
    this.agregarContrapartidaBancaria(asientos, fecha, conceptoBase, banco);

    console.log('✅ Total asientos generados:', asientos.length);
    const resumen = this.generateResumen(asientos);
    
    return { asientos, resumen };
  }

  private static agruparPorTipo(impuestos: any[]): { [key: string]: any[] } {
    const grupos: { [key: string]: any[] } = {};

    impuestos.forEach(impuesto => {
      const tipo = impuesto.tipoImpuesto || 'Otros Impuestos';
      
      if (!grupos[tipo]) {
        grupos[tipo] = [];
      }
      grupos[tipo].push(impuesto);
    });

    return grupos;
  }

  private static generarAsientoPorTipo(
    tipo: string, 
    impuestos: any[], 
    fecha: string, 
    conceptoBase: string, 
    asientos: AsientoContable[]
  ) {
    const totalImporte = impuestos.reduce((sum, imp) => sum + Math.abs(imp.importe || 0), 0);
    
    if (totalImporte <= 0) return;

    const cuentaContable = this.mapearCuentaContable(tipo);
    const esCredito = this.esCredito(tipo, impuestos);

    console.log(`✅ Generando asiento: ${tipo} - $${totalImporte} - Cuenta: ${cuentaContable}`);

    asientos.push({
      id: `${tipo.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random()}`,
      fecha,
      concepto: conceptoBase,
      circuitoContable: 'default',
      cuenta: cuentaContable,
      debe: esCredito ? totalImporte : 0,
      haber: esCredito ? 0 : totalImporte,
      descripcion: `${tipo} - ${impuestos.length} movimientos`
    });
  }

  private static mapearCuentaContable(tipo: string): string {
    const mapeo: { [key: string]: string } = {
      'Débito Ley 25413': 'Débito Impuesto Ley 25413',
      'Crédito Ley 25413': 'Crédito Impuesto Ley 25413',
      'Percepción IVA': 'Percepciones IVA',
      'Percepción IIBB': 'IIBB Percepciones',
      'Retención IVA': 'Retenciones IVA Sufridas',
      'Retención Ganancias': 'Retenciones Ganancias Sufridas',
      'Comisión Bancaria': 'Intereses y Gastos Bancarios',
      'Transferencia Bancaria': 'Intereses y Gastos Bancarios',
      'Crédito Transferencia': 'Intereses y Gastos Bancarios',
      'Impuesto General': 'Impuestos, Tasas y Contribuciones',
      'Otro Impuesto': 'Impuestos, Tasas y Contribuciones'
    };

    return mapeo[tipo] || 'Impuestos, Tasas y Contribuciones';
  }

  private static esCredito(tipo: string, impuestos: any[]): boolean {
    // Los créditos van al DEBE (son a favor de la empresa)
    // Los débitos van al HABER (son a pagar)
    
    if (tipo === 'Crédito Ley 25413') return true;
    if (tipo === 'Percepción IVA') return true;
    if (tipo === 'Percepción IIBB') return true;
    if (tipo === 'Retención IVA') return true;
    if (tipo === 'Retención Ganancias') return true;
    
    // Para otros casos, analizar el importe
    const primerImporte = impuestos[0]?.importe || 0;
    return primerImporte > 0;
  }

  private static agregarContrapartidaBancaria(
    asientos: AsientoContable[], 
    fecha: string, 
    conceptoBase: string, 
    banco: string
  ) {
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