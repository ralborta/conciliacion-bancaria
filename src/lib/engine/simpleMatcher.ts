// ESTE ES EL MOTOR SIMPLE QUE FUNCIONA COMO EL PYTHON
// Normaliza texto quitando acentos y hace merge simple por coincidencia

export class SimpleMatcher {
  // Normalización idéntica al Python
  private normalizeText(text: any): string {
    if (!text) return '';
    return String(text)
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');
  }
  
  // Separar impuestos del extracto bancario
  public separateImpuestos(extracto: any[]) {
    const impuestos = [];
    const movimientosLimpios = [];
    
    const esImpuesto = (concepto: string) => {
      const c = concepto.toLowerCase();
      return c.includes('impuesto') || c.includes('retencion') || 
             c.includes('iibb') || c.includes('ganancias') || 
             c.includes('comision') || c.includes('ley 25413');
    };
    
    extracto.forEach(mov => {
      if (esImpuesto(mov.concepto || '')) {
        impuestos.push(mov);
      } else {
        movimientosLimpios.push(mov);
      }
    });
    
    return { impuestos, movimientosLimpios };
  }
  
  // Merge simple como pandas
  public mergeSimple(arrayA: any[], arrayB: any[], keyA: string, keyB: string) {
    const matches = [];
    const noMatch = [];
    
    arrayA.forEach(itemA => {
      const keyNormA = this.normalizeText(itemA[keyA]);
      let matched = false;
      
      arrayB.forEach(itemB => {
        const keyNormB = this.normalizeText(itemB[keyB]);
        
        if (keyNormA && keyNormB && (keyNormA.includes(keyNormB) || keyNormB.includes(keyNormA))) {
          matches.push({ ...itemA, ...itemB, _matched: true });
          matched = true;
        }
      });
      
      if (!matched) noMatch.push(itemA);
    });
    
    return { matches, noMatch };
  }
}
