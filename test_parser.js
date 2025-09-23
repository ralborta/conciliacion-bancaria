// Script para probar el parser inteligente con archivos reales
const XLSX = require('xlsx');
const path = require('path');

// Función para analizar archivo Excel
function analyzeExcelFile(filePath, type) {
  console.log(`\n🔍 ANALIZANDO ${type.toUpperCase()}: ${path.basename(filePath)}`);
  console.log('='.repeat(60));
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON para análisis
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`📊 Filas totales: ${data.length}`);
    console.log(`📊 Columnas: ${data[0] ? data[0].length : 0}`);
    
    // Mostrar headers
    if (data.length > 0) {
      console.log('\n📋 HEADERS:');
      data[0].forEach((header, index) => {
        console.log(`  ${index}: "${header}"`);
      });
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
    
    return data;
  } catch (error) {
    console.error(`❌ Error analizando ${type}:`, error.message);
    return null;
  }
}

// Función principal
async function main() {
  console.log('🚀 INICIANDO ANÁLISIS DE ARCHIVOS PARA MATCHING');
  console.log('='.repeat(80));
  
  const ventasPath = '/Users/ralborta/Downloads/natero/prueba/test/test2/Ventas 2024-25.xlsx';
  const comprasPath = '/Users/ralborta/Downloads/natero/prueba/test/test2/Compras 2024-25.xlsx';
  const extractoPath = '/Users/ralborta/Downloads/natero/prueba/test/test2/ENERO2025.xlsx';
  
  // Analizar archivos
  const ventasData = analyzeExcelFile(ventasPath, 'ventas');
  const comprasData = analyzeExcelFile(comprasPath, 'compras');
  const extractoData = analyzeExcelFile(extractoPath, 'extracto');
  
  console.log('\n✅ ANÁLISIS COMPLETADO');
}

main().catch(console.error);
