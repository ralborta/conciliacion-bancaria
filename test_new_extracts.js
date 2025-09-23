// Script para probar con nuevos extractos
const XLSX = require('xlsx');
const path = require('path');

// Función para parsear fechas de Excel
function excelDateToJS(excelDate) {
  return new Date((excelDate - 25569) * 86400 * 1000);
}

// Función para parsear números
function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.,-]/g, '');
    const normalized = cleaned.replace(',', '.');
    return parseFloat(normalized) || 0;
  }
  return 0;
}

// Función para analizar extracto
function analyzeExtracto(filePath, nombre) {
  console.log(`\n🔍 ANALIZANDO ${nombre.toUpperCase()}:`);
  console.log('='.repeat(60));
  
  try {
    const workbook = XLSX.readFile(filePath);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    
    console.log(`📊 Filas totales: ${data.length}`);
    console.log(`📊 Columnas: ${data[0] ? data[0].length : 0}`);
    
    // Mostrar headers
    if (data.length > 0) {
      console.log('\n📋 HEADERS:');
      data[0].forEach((header, index) => {
        console.log(`  ${index}: "${header}"`);
      });
    }
    
    // Detectar formato
    const headers = data[0];
    const headerStr = headers.map(h => String(h || '').toLowerCase()).join('|');
    let formato = 'unknown';
    
    if (headerStr.includes('debito') && headerStr.includes('credito') && headerStr.includes('movimiento')) {
      formato = 'formato4';
      console.log('✅ FORMATO 4 DETECTADO: fecha, comprobante, movimiento, debito, credito, saldo');
    } else if (headerStr.includes('débito') && headerStr.includes('crédito')) {
      formato = 'formato2';
      console.log('✅ FORMATO 2 DETECTADO: Fecha, Concepto, Débito, Crédito, Saldo, Cuenta');
    } else if (headerStr.includes('importe')) {
      formato = 'formato3';
      console.log('✅ FORMATO 3 DETECTADO: Fecha, Concepto, Importe, Fecha Valor, Saldo');
    } else {
      console.log('❌ FORMATO DESCONOCIDO');
    }
    
    // Mostrar primeras 3 filas de datos
    console.log('\n📋 PRIMERAS 3 FILAS DE DATOS:');
    for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
      console.log(`\nFila ${i}:`);
      data[i].forEach((cell, index) => {
        const header = data[0][index] || `Col${index}`;
        console.log(`  ${header}: "${cell}"`);
      });
    }
    
    // Parsear movimientos
    const movimientos = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      let importe = 0;
      let concepto = '';
      let fecha = new Date();
      
      if (formato === 'formato4') {
        const debito = parseNumber(row[3]) || 0;
        const credito = parseNumber(row[4]) || 0;
        importe = credito - debito;
        concepto = row[2] || '';
        fecha = new Date(row[0]);
      } else if (formato === 'formato2') {
        const debito = parseNumber(row[2]) || 0;
        const credito = parseNumber(row[3]) || 0;
        importe = credito - debito;
        concepto = row[1] || '';
        fecha = new Date(row[0]);
      } else if (formato === 'formato3') {
        importe = parseNumber(row[2]);
        concepto = row[1] || '';
        fecha = new Date(row[0]);
      }
      
      if (importe !== 0) {
        movimientos.push({
          fecha: fecha,
          concepto: concepto,
          importe: importe,
          tipo: importe > 0 ? 'CRÉDITO' : 'DÉBITO'
        });
      }
    }
    
    console.log(`\n✅ Movimientos parseados: ${movimientos.length}`);
    console.log('📋 Primeros 3 movimientos:');
    movimientos.slice(0, 3).forEach((m, i) => {
      console.log(`  ${i+1}. ${m.fecha.toLocaleDateString('es-AR')} - ${m.concepto.substring(0, 30)} - $${m.importe} (${m.tipo})`);
    });
    
    return movimientos;
    
  } catch (error) {
    console.error(`❌ Error analizando ${nombre}:`, error.message);
    return [];
  }
}

// Función principal
async function main() {
  console.log('🚀 ANALIZANDO NUEVOS EXTRACTOS');
  console.log('='.repeat(80));
  
  const extractos = [
    {
      path: '/Users/ralborta/Downloads/natero/prueba/test/test2/1.25_movimientos.xlsx',
      nombre: 'Extracto 1.25'
    },
    {
      path: '/Users/ralborta/Downloads/natero/prueba/test/test2/mp-wallet_20250121144454_81fe.xlsx',
      nombre: 'MercadoPago Wallet'
    },
    {
      path: '/Users/ralborta/Downloads/natero/prueba/test/test2/Estado de Cuenta-1.xlsx',
      nombre: 'Estado de Cuenta'
    }
  ];
  
  for (const extracto of extractos) {
    const movimientos = analyzeExtracto(extracto.path, extracto.nombre);
    
    if (movimientos.length > 0) {
      const ingresos = movimientos.filter(m => m.importe > 0);
      const egresos = movimientos.filter(m => m.importe < 0);
      
      console.log(`\n📊 RESUMEN ${extracto.nombre.toUpperCase()}:`);
      console.log(`  💰 Ingresos: ${ingresos.length}`);
      console.log(`  💸 Egresos: ${egresos.length}`);
      console.log(`  📈 Total: ${movimientos.length}`);
      
      // Mostrar rango de fechas
      if (movimientos.length > 0) {
        const fechas = movimientos.map(m => m.fecha).sort();
        console.log(`  📅 Rango: ${fechas[0].toLocaleDateString('es-AR')} - ${fechas[fechas.length-1].toLocaleDateString('es-AR')}`);
      }
    }
  }
  
  console.log('\n✅ ANÁLISIS COMPLETADO');
}

main().catch(console.error);
