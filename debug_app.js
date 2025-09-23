// Script para diagnosticar problemas en la aplicación
const fs = require('fs');
const path = require('path');

console.log('🔍 DIAGNOSTICANDO APLICACIÓN');
console.log('='.repeat(60));

// Verificar archivos críticos
const archivosCriticos = [
  'src/lib/parsers/smartExtractoParser.ts',
  'src/lib/parsers/smartVentasComprasParser.ts',
  'src/lib/engine/matcher.ts',
  'src/lib/engine/multiBankOrchestrator.ts',
  'src/app/api/conciliation/process/route.ts'
];

console.log('\n📁 VERIFICANDO ARCHIVOS CRÍTICOS:');
archivosCriticos.forEach(archivo => {
  const ruta = path.join(process.cwd(), archivo);
  if (fs.existsSync(ruta)) {
    console.log(`✅ ${archivo}`);
  } else {
    console.log(`❌ ${archivo} - NO ENCONTRADO`);
  }
});

// Verificar imports en matcher.ts
console.log('\n🔍 VERIFICANDO IMPORTS EN MATCHER.TS:');
const matcherPath = path.join(process.cwd(), 'src/lib/engine/matcher.ts');
if (fs.existsSync(matcherPath)) {
  const contenido = fs.readFileSync(matcherPath, 'utf8');
  
  if (contenido.includes('SmartExtractoParser')) {
    console.log('✅ SmartExtractoParser importado');
  } else {
    console.log('❌ SmartExtractoParser NO importado');
  }
  
  if (contenido.includes('smartExtractoParser')) {
    console.log('✅ smartExtractoParser instanciado');
  } else {
    console.log('❌ smartExtractoParser NO instanciado');
  }
  
  if (contenido.includes('_isExcelData')) {
    console.log('✅ _isExcelData implementado');
  } else {
    console.log('❌ _isExcelData NO implementado');
  }
} else {
  console.log('❌ matcher.ts no encontrado');
}

// Verificar imports en multiBankOrchestrator.ts
console.log('\n🔍 VERIFICANDO IMPORTS EN MULTIBANKORCHESTRATOR.TS:');
const orchestratorPath = path.join(process.cwd(), 'src/lib/engine/multiBankOrchestrator.ts');
if (fs.existsSync(orchestratorPath)) {
  const contenido = fs.readFileSync(orchestratorPath, 'utf8');
  
  if (contenido.includes('SmartVentasComprasParser')) {
    console.log('✅ SmartVentasComprasParser importado');
  } else {
    console.log('❌ SmartVentasComprasParser NO importado');
  }
  
  if (contenido.includes('SmartExtractoParser')) {
    console.log('✅ SmartExtractoParser importado');
  } else {
    console.log('❌ SmartExtractoParser NO importado');
  }
  
  if (contenido.includes('smartVentasComprasParser')) {
    console.log('✅ smartVentasComprasParser instanciado');
  } else {
    console.log('❌ smartVentasComprasParser NO instanciado');
  }
} else {
  console.log('❌ multiBankOrchestrator.ts no encontrado');
}

// Verificar package.json
console.log('\n📦 VERIFICANDO DEPENDENCIAS:');
const packagePath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  if (packageJson.dependencies.xlsx) {
    console.log('✅ xlsx instalado');
  } else {
    console.log('❌ xlsx NO instalado');
  }
  
  if (packageJson.dependencies.exceljs) {
    console.log('✅ exceljs instalado');
  } else {
    console.log('❌ exceljs NO instalado');
  }
} else {
  console.log('❌ package.json no encontrado');
}

// Verificar errores de sintaxis
console.log('\n🔍 VERIFICANDO SINTAXIS:');
const archivosTS = [
  'src/lib/parsers/smartExtractoParser.ts',
  'src/lib/parsers/smartVentasComprasParser.ts',
  'src/lib/engine/matcher.ts'
];

archivosTS.forEach(archivo => {
  const ruta = path.join(process.cwd(), archivo);
  if (fs.existsSync(ruta)) {
    try {
      const contenido = fs.readFileSync(ruta, 'utf8');
      // Verificar paréntesis balanceados
      const abiertos = (contenido.match(/\{/g) || []).length;
      const cerrados = (contenido.match(/\}/g) || []).length;
      
      if (abiertos === cerrados) {
        console.log(`✅ ${archivo} - Sintaxis OK`);
      } else {
        console.log(`❌ ${archivo} - Paréntesis desbalanceados (${abiertos} abiertos, ${cerrados} cerrados)`);
      }
    } catch (error) {
      console.log(`❌ ${archivo} - Error leyendo archivo: ${error.message}`);
    }
  }
});

console.log('\n✅ DIAGNÓSTICO COMPLETADO');
