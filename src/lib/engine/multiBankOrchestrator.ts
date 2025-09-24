// MultiBankReconciliationOrchestrator.ts - VERSIÓN CORREGIDA
// Permite continuar el proceso sin reinicializar desde cero

import { VentaCanon, CompraCanon, ExtractoCanon, MatchResult, ProcessOptions } from '@/lib/types/conciliacion'
import { ConciliationEngine } from './matcher'
import { SmartVentasComprasParser } from '../parsers/smartVentasComprasParser'
import { SmartExtractoParser } from '../parsers/smartExtractoParser'

export interface BankProcessingStep {
  bankName: string
  processedAt: Date
  matchedCount: number
  pendingCount: number
  totalVentas: number
  totalCompras: number
  ventasConciliadas: number
  comprasConciliadas: number
}

export interface MultiBankResult {
  totalMatched: number
  totalPending: number
  matchRate: number
  allMatched: MatchResult[]
  allPending: MatchResult[]
  consolidatedAsientos: any[]
  steps: BankProcessingStep[]
}

export class MultiBankReconciliationOrchestrator {
  private initialized = false;
  private baseVentas: any[] = [];
  private baseCompras: any[] = [];
  private unmatched: any = null;
  private processedBanks: any[] = [];
  private allMatchedTransactions: any[] = [];
  
  constructor() {
    console.log('🎯 MultiBankOrchestrator - Constructor');
  }

  /**
   * MÉTODO NUEVO: Verificar si ya está inicializado
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Inicializar SOLO la primera vez
   */
  async initialize(ventasFile: File, comprasFile: File): Promise<void> {
    if (this.initialized) {
      console.log('⚠️ Orquestador ya inicializado, saltando initialize');
      return;
    }

    console.log('🚀 Inicializando orquestador por primera vez...');
    
    // Parsear archivos base (solo una vez)
    this.baseVentas = await this.parseVentasFile(ventasFile);
    this.baseCompras = await this.parseComprasFile(comprasFile);
    
    this.initialized = true;
    console.log('✅ Orquestador inicializado:', {
      ventas: this.baseVentas.length,
      compras: this.baseCompras.length
    });
  }

  /**
   * MÉTODO NUEVO: Continuar con siguiente banco
   * Este método NO reinicia, solo agrega un banco nuevo
   */
  async continueWithBank(extractoFile: File, banco: string, periodo: string): Promise<any> {
    console.log('🏦 Continuando con banco:', banco);
    
    if (!this.initialized) {
      throw new Error('Orquestrador no inicializado. Usa initialize() primero.');
    }

    // Usar transacciones no conciliadas del resultado anterior
    const ventasParaProcesar = this.unmatched?.ventas || this.baseVentas;
    const comprasParaProcesar = this.unmatched?.compras || this.baseCompras;
    
    console.log('📊 Procesando:', {
      ventasPendientes: ventasParaProcesar.length,
      comprasPendientes: comprasParaProcesar.length,
      banco
    });

    // Si no hay transacciones pendientes, retornar resultado vacío
    if (ventasParaProcesar.length === 0 && comprasParaProcesar.length === 0) {
      return this.createEmptyResult(banco);
    }

    // Procesar solo con las transacciones pendientes
    const result = await this.processWithEngine(
      ventasParaProcesar,
      comprasParaProcesar, 
      extractoFile,
      banco,
      periodo
    );

    // Actualizar estado con nuevos resultados
    this.updateUnmatchedState(result);
    this.processedBanks.push({
      banco,
      processedAt: new Date(),
      matchedCount: result.matched?.length || 0,
      totalProcessed: ventasParaProcesar.length + comprasParaProcesar.length
    });

    return this.enrichResultWithMultiBankInfo(result, banco);
  }

  /**
   * MÉTODO NUEVO: Procesar primer banco
   */
  async processFirstBank(extractoFile: File, banco: string, periodo: string): Promise<any> {
    console.log('🥇 Procesando primer banco:', banco);
    
    if (!this.initialized) {
      throw new Error('Orquestrador no inicializado. Usa initialize() primero.');
    }

    // Procesar con todos los datos base
    const result = await this.processWithEngine(
      this.baseVentas,
      this.baseCompras,
      extractoFile,
      banco,
      periodo
    );

    // Guardar transacciones no conciliadas para siguientes bancos
    this.updateUnmatchedState(result);
    this.processedBanks.push({
      banco,
      processedAt: new Date(),
      matchedCount: result.matched?.length || 0,
      totalProcessed: this.baseVentas.length + this.baseCompras.length
    });

    return this.enrichResultWithMultiBankInfo(result, banco);
  }

  /**
   * Usar el motor existente SIN modificarlo
   */
  private async processWithEngine(ventas: any[], compras: any[], extractoFile: File, banco: string, periodo: string): Promise<any> {
    // AQUÍ va la llamada al ConciliationEngine existente
    // SIN TOCAR NADA del motor original
    
    // Convertir arrays a CSV para mantener compatibilidad
    const ventasCsv = this.convertArrayToCSV(ventas);
    const comprasCsv = this.convertArrayToCSV(compras);
    
    // Crear archivos temporales
    const ventasFile = new File([ventasCsv], 'ventas_temp.csv', { type: 'text/csv' });
    const comprasFile = new File([comprasCsv], 'compras_temp.csv', { type: 'text/csv' });
    
    // Llamar al motor existente (el que ya funciona)
    const formData = new FormData();
    formData.append('ventas', ventasFile);
    formData.append('compras', comprasFile);
    formData.append('extracto', extractoFile);
    formData.append('banco', banco);
    formData.append('periodo', periodo);
    
    // Usar la API existente que ya funciona
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://conciliacion-bancaria-production.up.railway.app';
    const response = await fetch(`${apiUrl}/api/conciliation/process`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Error en conciliación: ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Actualizar estado de transacciones no conciliadas
   */
  private updateUnmatchedState(result: any): void {
    if (result.data?.unmatched) {
      this.unmatched = result.data.unmatched;
    } else {
      // Si no hay unmatched en el resultado, crear desde los datos base
      this.unmatched = {
        ventas: this.baseVentas.filter(v => !this.isTransactionMatched(v, result)),
        compras: this.baseCompras.filter(c => !this.isTransactionMatched(c, result))
      };
    }
    
    console.log('🔄 Estado actualizado:', {
      ventasNoConc: this.unmatched.ventas.length,
      comprasNoConc: this.unmatched.compras.length
    });
  }

  /**
   * Crear resultado vacío cuando no hay transacciones pendientes
   */
  private createEmptyResult(banco: string): any {
    return {
      success: true,
      data: {
        totalMovimientos: 0,
        conciliados: 0,
        pendientes: 0,
        porcentajeConciliado: 0,
        movements: [],
        noPendingTransactions: true,
        isMultiBank: true,
        bankSteps: this.processedBanks,
        banco
      }
    };
  }

  /**
   * Enriquecer resultado con info multi-banco
   */
  private enrichResultWithMultiBankInfo(result: any, banco: string): any {
    if (result.data) {
      result.data.isMultiBank = true;
      result.data.bankSteps = this.processedBanks;
      result.data.currentBank = banco;
    }
    return result;
  }

  /**
   * Verificar si una transacción ya fue conciliada
   */
  private isTransactionMatched(transaction: any, result: any): boolean {
    // Lógica para verificar si la transacción ya está en matched
    if (!result.data?.movements) return false;
    
    return result.data.movements.some((mov: any) => 
      mov.referencia === transaction.id || 
      mov.monto === transaction.total ||
      (mov.fecha === transaction.fecha && Math.abs(mov.monto - transaction.total) < 0.01)
    );
  }

  /**
   * Convertir array a CSV
   */
  private convertArrayToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Parsers (usar los existentes del proyecto)
   */
  private async parseVentasFile(file: File): Promise<any[]> {
    // Usar el parser existente del proyecto
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      const Papa = await import('papaparse');
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              reject(new Error('Error al parsear CSV de ventas'));
            } else {
              resolve(results.data as any[]);
            }
          },
          error: (error) => reject(error)
        });
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const smartParser = new SmartVentasComprasParser();
      const buffer = await file.arrayBuffer();
      return smartParser.parseVentas(buffer);
    }
    
    return [];
  }

  private async parseComprasFile(file: File): Promise<any[]> {
    // Usar el parser existente del proyecto
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      const Papa = await import('papaparse');
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              reject(new Error('Error al parsear CSV de compras'));
            } else {
              resolve(results.data as any[]);
            }
          },
          error: (error) => reject(error)
        });
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const smartParser = new SmartVentasComprasParser();
      const buffer = await file.arrayBuffer();
      return smartParser.parseCompras(buffer);
    }
    
    return [];
  }

  /**
   * Obtener resumen del proceso
   */
  getProcessSummary(): any {
    return {
      bancosProcesados: this.processedBanks.length,
      totalConciliadas: this.allMatchedTransactions.length,
      ventasPendientes: this.unmatched?.ventas?.length || 0,
      comprasPendientes: this.unmatched?.compras?.length || 0,
      steps: this.processedBanks
    };
  }

  /**
   * Reset para nuevo proceso
   */
  reset(): void {
    this.initialized = false;
    this.baseVentas = [];
    this.baseCompras = [];
    this.unmatched = null;
    this.processedBanks = [];
    this.allMatchedTransactions = [];
    console.log('🔄 Orquestador reseteado');
  }

  // MÉTODOS DE COMPATIBILIDAD (para no romper el código existente)
  
  /**
   * Procesar banco (método de compatibilidad)
   */
  async processBank(extractFile: File, bankName: string, options: ProcessOptions): Promise<MatchResult[]> {
    const result = await this.continueWithBank(extractFile, bankName, options.periodo || '');
    
    // Convertir resultado a formato MatchResult[]
    if (result.data?.movements) {
      return result.data.movements.map((mov: any, index: number) => ({
        id: `match_${index}`,
        extractoItem: {
          id: mov.id || `extracto_${index}`,
          banco: bankName,
          cuenta: mov.cuenta || 'N/A',
          fechaOperacion: new Date(mov.fecha),
          concepto: mov.concepto || '',
          importe: mov.monto || 0,
          saldo: 0
        },
        matchedWith: mov.matchingDetails?.matchedWith || null,
        score: mov.matchingDetails?.score || 0,
        status: mov.estado === 'conciliado' ? 'matched' : 'pending',
        tipo: mov.tipo || 'venta',
        reason: mov.reason || 'Procesado'
      }));
    }
    
    return [];
  }

  /**
   * Generar resultado final (método de compatibilidad)
   */
  generateFinalResult(): MultiBankResult {
    const totalMatched = this.allMatchedTransactions.length;
    const totalPending = (this.unmatched?.ventas?.length || 0) + (this.unmatched?.compras?.length || 0);
    const totalMovimientos = totalMatched + totalPending;
    const matchRate = totalMovimientos > 0 ? (totalMatched / totalMovimientos) * 100 : 0;

    return {
      steps: this.processedBanks.map(step => ({
        bankName: step.banco,
        processedAt: step.processedAt,
        matchedCount: step.matchedCount,
        pendingCount: 0,
        totalVentas: this.baseVentas.length,
        totalCompras: this.baseCompras.length,
        ventasConciliadas: 0,
        comprasConciliadas: 0
      })),
      allMatched: [],
      allPending: [],
      totalMatched,
      totalPending,
      matchRate,
      consolidatedAsientos: []
    };
  }
}


