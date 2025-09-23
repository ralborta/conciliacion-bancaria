// Script para emular el proceso completo de matching
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

// Función para parsear ventas
function parseVentas(filePath) {
  console.log('\n🔍 PARSING VENTAS:');
  console.log('='.repeat(50));
  
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  
  const ventas = [];
  const headers = data[0];
  
  // Mapear columnas
  const columnMap = {
    fecha: headers.findIndex(h => String(h).toLowerCase().includes('fecha')),
    tipo: headers.findIndex(h => String(h).toLowerCase().includes('tipo')),
    numero: headers.findIndex(h => String(h).toLowerCase().includes('comprobante')),
    cliente: headers.findIndex(h => String(h).toLowerCase().includes('cliente')),
    neto: headers.findIndex(h => String(h).toLowerCase().includes('importe bruto')),
    iva: headers.findIndex(h => String(h).toLowerCase().includes('impuestos')),
    total: headers.findIndex(h => String(h).toLowerCase().includes('total'))
  };
  
  console.log('📊 Mapeo de columnas:', columnMap);
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[columnMap.fecha] || !row[columnMap.total]) continue;
    
    const venta = {
      id: `venta_${i}`,
      fecha: excelDateToJS(parseNumber(row[columnMap.fecha])),
      tipo: row[columnMap.tipo] || '',
      numero: row[columnMap.numero] || '',
      cliente: row[columnMap.cliente] || '',
      neto: parseNumber(row[columnMap.neto]),
      iva: parseNumber(row[columnMap.iva]),
      total: parseNumber(row[columnMap.total])
    };
    
    if (venta.total > 0) {
      ventas.push(venta);
    }
  }
  
  console.log(`✅ Ventas parseadas: ${ventas.length}`);
  console.log('📋 Primeras 3 ventas:');
  ventas.slice(0, 3).forEach((v, i) => {
    console.log(`  ${i+1}. ${v.fecha.toLocaleDateString('es-AR')} - ${v.cliente} - $${v.total}`);
  });
  
  return ventas;
}

// Función para parsear compras
function parseCompras(filePath) {
  console.log('\n🔍 PARSING COMPRAS:');
  console.log('='.repeat(50));
  
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  
  const compras = [];
  const headers = data[0];
  
  // Mapear columnas
  const columnMap = {
    fecha: headers.findIndex(h => String(h).toLowerCase().includes('fecha')),
    tipo: headers.findIndex(h => String(h).toLowerCase().includes('tipo')),
    numero: headers.findIndex(h => String(h).toLowerCase().includes('comprobante')),
    proveedor: headers.findIndex(h => String(h).toLowerCase().includes('proveedor')),
    neto: headers.findIndex(h => String(h).toLowerCase().includes('importe bruto')),
    iva: headers.findIndex(h => String(h).toLowerCase().includes('impuestos')),
    total: headers.findIndex(h => String(h).toLowerCase().includes('total'))
  };
  
  console.log('📊 Mapeo de columnas:', columnMap);
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[columnMap.fecha] || !row[columnMap.total]) continue;
    
    const compra = {
      id: `compra_${i}`,
      fecha: excelDateToJS(parseNumber(row[columnMap.fecha])),
      tipo: row[columnMap.tipo] || '',
      numero: row[columnMap.numero] || '',
      proveedor: row[columnMap.proveedor] || '',
      neto: parseNumber(row[columnMap.neto]),
      iva: parseNumber(row[columnMap.iva]),
      total: parseNumber(row[columnMap.total])
    };
    
    if (compra.total > 0) {
      compras.push(compra);
    }
  }
  
  console.log(`✅ Compras parseadas: ${compras.length}`);
  console.log('📋 Primeras 3 compras:');
  compras.slice(0, 3).forEach((c, i) => {
    console.log(`  ${i+1}. ${c.fecha.toLocaleDateString('es-AR')} - ${c.proveedor} - $${c.total}`);
  });
  
  return compras;
}

// Función para parsear extracto
function parseExtracto(filePath) {
  console.log('\n🔍 PARSING EXTRACTO:');
  console.log('='.repeat(50));
  
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  
  const movimientos = [];
  const headers = data[0];
  
  console.log('📊 Headers del extracto:', headers);
  
  // Detectar formato
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
  }
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    let importe = 0;
    let concepto = '';
    
    if (formato === 'formato4') {
      const debito = parseNumber(row[3]) || 0;
      const credito = parseNumber(row[4]) || 0;
      importe = credito - debito;
      concepto = row[2] || '';
    } else if (formato === 'formato2') {
      const debito = parseNumber(row[2]) || 0;
      const credito = parseNumber(row[3]) || 0;
      importe = credito - debito;
      concepto = row[1] || '';
    } else if (formato === 'formato3') {
      importe = parseNumber(row[2]);
      concepto = row[1] || '';
    }
    
    if (importe !== 0) {
      const movimiento = {
        id: `mov_${i}`,
        fecha: new Date(row[0]),
        concepto: concepto,
        importe: importe,
        tipo: importe > 0 ? 'CRÉDITO' : 'DÉBITO'
      };
      
      movimientos.push(movimiento);
    }
  }
  
  console.log(`✅ Movimientos parseados: ${movimientos.length}`);
  console.log('📋 Primeros 3 movimientos:');
  movimientos.slice(0, 3).forEach((m, i) => {
    console.log(`  ${i+1}. ${m.fecha.toLocaleDateString('es-AR')} - ${m.concepto.substring(0, 30)} - $${m.importe} (${m.tipo})`);
  });
  
  return movimientos;
}

// Función para simular matching
function simulateMatching(ventas, compras, movimientos) {
  console.log('\n🔄 SIMULANDO MATCHING:');
  console.log('='.repeat(60));
  
  const matches = [];
  const toleranciaMonto = 0.02; // 2%
  const toleranciaFecha = 3; // 3 días
  
  // Matching de ventas (ingresos)
  const ingresos = movimientos.filter(m => m.importe > 0);
  console.log(`\n💰 INGRESOS: ${ingresos.length} movimientos`);
  
  for (const ingreso of ingresos) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const venta of ventas) {
      // Calcular score de matching
      let score = 0;
      
      // Match por monto (40% peso)
      const diffMonto = Math.abs(ingreso.importe - venta.total);
      const toleranciaMontoValor = venta.total * toleranciaMonto;
      if (diffMonto <= toleranciaMontoValor) {
        score += 0.4;
      } else {
        score += Math.max(0, 0.4 - (diffMonto / venta.total) * 0.4);
      }
      
      // Match por fecha (30% peso)
      const diffFecha = Math.abs(ingreso.fecha.getTime() - venta.fecha.getTime()) / (1000 * 60 * 60 * 24);
      if (diffFecha <= toleranciaFecha) {
        score += 0.3;
      } else {
        score += Math.max(0, 0.3 - (diffFecha / 30) * 0.3);
      }
      
      // Match por concepto (30% peso)
      const conceptoMatch = ingreso.concepto.toLowerCase().includes(venta.cliente.toLowerCase()) ||
                           venta.cliente.toLowerCase().includes(ingreso.concepto.toLowerCase());
      if (conceptoMatch) {
        score += 0.3;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = venta;
      }
    }
    
    if (bestMatch && bestScore > 0.5) {
      matches.push({
        tipo: 'venta',
        movimiento: ingreso,
        transaccion: bestMatch,
        score: bestScore,
        status: 'matched'
      });
    } else {
      matches.push({
        tipo: 'venta',
        movimiento: ingreso,
        transaccion: null,
        score: bestScore,
        status: 'pending'
      });
    }
  }
  
  // Matching de compras (egresos)
  const egresos = movimientos.filter(m => m.importe < 0);
  console.log(`\n💸 EGRESOS: ${egresos.length} movimientos`);
  
  for (const egreso of egresos) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const compra of compras) {
      // Calcular score de matching
      let score = 0;
      
      // Match por monto (40% peso)
      const diffMonto = Math.abs(Math.abs(egreso.importe) - compra.total);
      const toleranciaMontoValor = compra.total * toleranciaMonto;
      if (diffMonto <= toleranciaMontoValor) {
        score += 0.4;
      } else {
        score += Math.max(0, 0.4 - (diffMonto / compra.total) * 0.4);
      }
      
      // Match por fecha (30% peso)
      const diffFecha = Math.abs(egreso.fecha.getTime() - compra.fecha.getTime()) / (1000 * 60 * 60 * 24);
      if (diffFecha <= toleranciaFecha) {
        score += 0.3;
      } else {
        score += Math.max(0, 0.3 - (diffFecha / 30) * 0.3);
      }
      
      // Match por concepto (30% peso)
      const conceptoMatch = egreso.concepto.toLowerCase().includes(compra.proveedor.toLowerCase()) ||
                           compra.proveedor.toLowerCase().includes(egreso.concepto.toLowerCase());
      if (conceptoMatch) {
        score += 0.3;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = compra;
      }
    }
    
    if (bestMatch && bestScore > 0.5) {
      matches.push({
        tipo: 'compra',
        movimiento: egreso,
        transaccion: bestMatch,
        score: bestScore,
        status: 'matched'
      });
    } else {
      matches.push({
        tipo: 'compra',
        movimiento: egreso,
        transaccion: null,
        score: bestScore,
        status: 'pending'
      });
    }
  }
  
  return matches;
}

// Función principal
async function main() {
  console.log('🚀 INICIANDO EMULACIÓN DE MATCHING');
  console.log('='.repeat(80));
  
  const ventasPath = '/Users/ralborta/Downloads/natero/prueba/test/test2/Ventas 2024-25.xlsx';
  const comprasPath = '/Users/ralborta/Downloads/natero/prueba/test/test2/Compras 2024-25.xlsx';
  const extractoPath = '/Users/ralborta/Downloads/natero/prueba/test/test2/ENERO2025.xlsx';
  
  try {
    // Parsear archivos
    const ventas = parseVentas(ventasPath);
    const compras = parseCompras(comprasPath);
    const movimientos = parseExtracto(extractoPath);
    
    // Simular matching
    const matches = simulateMatching(ventas, compras, movimientos);
    
    // Mostrar resultados
    console.log('\n📊 RESULTADOS DEL MATCHING:');
    console.log('='.repeat(60));
    
    const matched = matches.filter(m => m.status === 'matched');
    const pending = matches.filter(m => m.status === 'pending');
    
    console.log(`✅ Conciliados: ${matched.length}`);
    console.log(`⏳ Pendientes: ${pending.length}`);
    console.log(`📈 Tasa de conciliación: ${((matched.length / matches.length) * 100).toFixed(2)}%`);
    
    console.log('\n🎯 EJEMPLOS DE MATCHES:');
    matched.slice(0, 5).forEach((match, i) => {
      console.log(`\n${i+1}. ${match.tipo.toUpperCase()}:`);
      console.log(`   Movimiento: ${match.movimiento.fecha.toLocaleDateString('es-AR')} - $${match.movimiento.importe}`);
      console.log(`   Transacción: ${match.transaccion.fecha.toLocaleDateString('es-AR')} - $${match.transaccion.total}`);
      console.log(`   Score: ${(match.score * 100).toFixed(1)}%`);
    });
    
    console.log('\n⏳ EJEMPLOS DE PENDIENTES:');
    pending.slice(0, 5).forEach((match, i) => {
      console.log(`\n${i+1}. ${match.tipo.toUpperCase()}:`);
      console.log(`   Movimiento: ${match.movimiento.fecha.toLocaleDateString('es-AR')} - $${match.movimiento.importe}`);
      console.log(`   Mejor score: ${(match.score * 100).toFixed(1)}%`);
    });
    
  } catch (error) {
    console.error('❌ Error en la emulación:', error);
  }
  
  console.log('\n✅ EMULACIÓN COMPLETADA');
}

main().catch(console.error);
