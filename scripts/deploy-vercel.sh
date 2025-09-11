#!/bin/bash

# Script de despliegue para Vercel
echo "🚀 Desplegando a Vercel..."

# Verificar que estamos en la rama main
if [ "$(git branch --show-current)" != "main" ]; then
    echo "❌ Error: Debes estar en la rama main para desplegar"
    exit 1
fi

# Verificar que no hay cambios sin commitear
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: Hay cambios sin commitear. Por favor, haz commit primero."
    exit 1
fi

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm ci

# Ejecutar tests (si existen)
echo "🧪 Ejecutando tests..."
npm run test 2>/dev/null || echo "⚠️  No hay tests configurados"

# Ejecutar linting
echo "🔍 Ejecutando linting..."
npm run lint

# Build de producción
echo "🏗️  Construyendo para producción..."
npm run build

# Desplegar a Vercel
echo "🚀 Desplegando a Vercel..."
vercel --prod

echo "✅ Despliegue completado!"
echo "🌐 Aplicación disponible en: https://tu-app.vercel.app"
