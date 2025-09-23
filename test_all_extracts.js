// Script para probar matching con todos los extractos
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

// Función para parsear ventas (misma que antes)
function parseVentas(filePath) {
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  
  const ventas = [];
  const headers = data[0];
  const columnMap = {
    fecha: headers.findIndex(h => String(h).toLowerCase().includes('fecha')),
    tipo: headers.findIndex(h => String(h).toLowerCase().includes('tipo')),
    numero: headers.findIndex(h => String(h).toLowerCase().includes('comprobante')),
    cliente: headers.findIndex(h => String(h).toLowerCase().includes('cliente')),
    neto: headers.findIndex(h => String(h).toLowerCase().includes('importe bruto')),
    iva: headers.findIndex(h => String(h).toLowerCase().includes('impuestos')),
    total: headers.findIndex(h => String(h).toLowerCase().includes('total'))
  };
  
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
  
  return ventas;
}

// Función para parsear compras (misma que antes)
function parseCompras(filePath) {
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  
  const compras = [];
  const headers = data[0];
  const columnMap = {
    fecha: headers.findIndex(h => String(h).toLowerCase().includes('fecha')),
    tipo: headers.findIndex(h => String(h).toLowerCase().includes('tipo')),
    numero: headers.findIndex(h => String(h).toLowerCase().includes('comprobante')),
    proveedor: headers.findIndex(h => String(h).toLowerCase().includes('proveedor')),
    neto: headers.findIndex(h => String(h).toLowerCase().includes('importe bruto')),
    iva: headers.findIndex(h => String(h).toLowerCase().includes('impuestos')),
    total: headers.findIndex(h => String(h).toLowerCase().includes('total'))
  };
  
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
  
  return compras;
}

// Función para parsear extracto
function parseExtracto(filePath, nombre) {
  console.log(`\n🔍 PARSING ${nombre.toUpperCase()}:`);
  console.log('='.repeat(50));
  
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  
  const movimientos = [];
  const headers = data[0];
  
  // Detectar formato
  const headerStr = headers.map(h => String(h || '').toLowerCase()).join('|');
  let formato = 'unknown';
  
  if (headerStr.includes('debito') && headerStr.includes('credito') && headerStr.includes('movimiento')) {
    formato = 'formato4';
  } else if (headerStr.includes('débito') && headerStr.includes('crédito')) {
    formato = 'formato2';
  } else if (headerStr.includes('importe')) {
    formato = 'formato3';
  }
  
  console.log(`✅ Formato detectado: ${formato}`);
  
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
      const debito = parseNumber(row[3]) || 0;
      const credito = parseNumber(row[4]) || 0;
      importe = credito - debito;
      concepto = row[2] || '';
      fecha = new Date(row[0]);
    } else if (formato === 'formato3') {
      importe = parseNumber(row[2]);
      concepto = row[1] || '';
      fecha = new Date(row[0]);
    }
    
    if (importe !== 0) {
      movimientos.push({
        id: `mov_${i}`,
        fecha: fecha,
        concepto: concepto,
        importe: importe,
        tipo: importe > 0 ? 'CRÉDITO' : 'DÉBITO'
      });
    }
  }
  
  console.log(`✅ Movimientos parseados: ${movimientos.length}`);
  return movimientos;
}

// Función para simular matching
function simulateMatching(ventas, compras, movimientos, extractoNombre) {
  console.log(`\n🔄 MATCHING CON ${extractoNombre.toUpperCase()}:`);
  console.log('='.repeat(60));
  
  const matches = [];
  const toleranciaMonto = 0.05; // 5% (más flexible)
  const toleranciaFecha = 7; // 7 días (más flexible)
  
  // Matching de ventas (ingresos)
  const ingresos = movimientos.filter(m => m.importe > 0);
  console.log(`💰 INGRESOS: ${ingresos.length} movimientos`);
  
  for (const ingreso of ingresos) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const venta of ventas) {
      let score = 0;
      
      // Match por monto (50% peso)
      const diffMonto = Math.abs(ingreso.importe - venta.total);
      const toleranciaMontoValor = venta.total * toleranciaMonto;
      if (diffMonto <= toleranciaMontoValor) {
        score += 0.5;
      } else {
        score += Math.max(0, 0.5 - (diffMonto / venta.total) * 0.5);
      }
      
      // Match por fecha (30% peso)
      const diffFecha = Math.abs(ingreso.fecha.getTime() - venta.fecha.getTime()) / (1000 * 60 * 60 * 24);
      if (diffFecha <= toleranciaFecha) {
        score += 0.3;
      } else {
        score += Math.max(0, 0.3 - (diffFecha / 30) * 0.3);
      }
      
      // Match por concepto (20% peso)
      const conceptoMatch = ingreso.concepto.toLowerCase().includes(venta.cliente.toLowerCase()) ||
                           venta.cliente.toLowerCase().includes(ingreso.concepto.toLowerCase());
      if (conceptoMatch) {
        score += 0.2;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = venta;
      }
    }
    
    if (bestMatch && bestScore > 0.4) { // Umbral más bajo
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
  console.log(`💸 EGRESOS: ${egresos.length} movimientos`);
  
  for (const egreso of egresos) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const compra of compras) {
      let score = 0;
      
      // Match por monto (50% peso)
      const diffMonto = Math.abs(Math.abs(egreso.importe) - compra.total);
      const toleranciaMontoValor = compra.total * toleranciaMonto;
      if (diffMonto <= toleranciaMontoValor) {
        score += 0.5;
      } else {
        score += Math.max(0, 0.5 - (diffMonto / compra.total) * 0.5);
      }
      
      // Match por fecha (30% peso)
      const diffFecha = Math.abs(egreso.fecha.getTime() - compra.fecha.getTime()) / (1000 * 60 * 60 * 24);
      if (diffFecha <= toleranciaFecha) {
        score += 0.3;
      } else {
        score += Math.max(0, 0.3 - (diffFecha / 30) * 0.3);
      }
      
      // Match por concepto (20% peso)
      const conceptoMatch = egreso.concepto.toLowerCase().includes(compra.proveedor.toLowerCase()) ||
                           compra.proveedor.toLowerCase().includes(egreso.concepto.toLowerCase());
      if (conceptoMatch) {
        score += 0.2;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = compra;
      }
    }
    
    if (bestMatch && bestScore > 0.4) { // Umbral más bajo
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
  console.log('🚀 PROBANDO MATCHING CON TODOS LOS EXTRACTOS');
  console.log('='.repeat(80));
  
  // Parsear ventas y compras (una sola vez)
  console.log('📊 Parseando ventas y compras...');
  const ventas = parseVentas('/Users/ralborta/Downloads/natero/prueba/test/test2/Ventas 2024-25.xlsx');
  const compras = parseCompras('/Users/ralborta/Downloads/natero/prueba/test/test2/Compras 2024-25.xlsx');
  
  console.log(`✅ Ventas: ${ventas.length}`);
  console.log(`✅ Compras: ${compras.length}`);
  
  // Probar con cada extracto
  const extractos = [
    {
      path: '/Users/ralborta/Downloads/natero/prueba/test/test2/ENERO2025.xlsx',
      nombre: 'ENERO2025'
    },
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
    try {
      const movimientos = parseExtracto(extracto.path, extracto.nombre);
      
      if (movimientos.length > 0) {
        const matches = simulateMatching(ventas, compras, movimientos, extracto.nombre);
        
        const matched = matches.filter(m => m.status === 'matched');
        const pending = matches.filter(m => m.status === 'pending');
        
        console.log(`\n📊 RESULTADOS ${extracto.nombre.toUpperCase()}:`);
        console.log(`  ✅ Conciliados: ${matched.length}`);
        console.log(`  ⏳ Pendientes: ${pending.length}`);
        console.log(`  📈 Tasa: ${((matched.length / matches.length) * 100).toFixed(2)}%`);
        
        // Mostrar algunos ejemplos
        if (matched.length > 0) {
          console.log(`\n🎯 MEJORES MATCHES:`);
          matched.slice(0, 3).forEach((match, i) => {
            console.log(`  ${i+1}. ${match.tipo.toUpperCase()}: ${match.movimiento.fecha.toLocaleDateString('es-AR')} - $${match.movimiento.importe} -> $${match.transaccion.total} (${(match.score * 100).toFixed(1)}%)`);
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error con ${extracto.nombre}:`, error.message);
    }
  }
  
  console.log('\n✅ ANÁLISIS COMPLETADO');
}

main().catch(console.error);
