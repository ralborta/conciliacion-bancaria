# 🚀 Guía de Despliegue - Conciliación Bancaria

## Vercel (Frontend)

### 1. Configuración inicial
```bash
# Instalar Vercel CLI
npm i -g vercel

# Login en Vercel
vercel login

# Desplegar
vercel --prod
```

### 2. Variables de entorno en Vercel
Configurar en el dashboard de Vercel:
- `NEXT_PUBLIC_APP_URL`: https://tu-app.vercel.app
- `NEXT_PUBLIC_RAILWAY_URL`: https://tu-api.railway.app
- `NODE_ENV`: production

### 3. Configuración de dominio
- Dominio personalizado (opcional)
- Configurar SSL automático

## Railway (Backend/API)

### 1. Configuración inicial
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login en Railway
railway login

# Inicializar proyecto
railway init

# Desplegar (usando Docker)
railway up
```

### 2. Variables de entorno en Railway
- `DATABASE_URL`: URL de PostgreSQL
- `NEXT_PUBLIC_APP_URL`: https://tu-app.vercel.app
- `NODE_ENV`: production
- `PORT`: 3000

### 3. Base de datos
- Crear servicio PostgreSQL en Railway
- Configurar `DATABASE_URL` automáticamente

### 4. Configuración de Build
- **Builder**: Docker (recomendado)
- **Dockerfile**: Incluido en el proyecto
- **Health Check**: `/api/health`

## Estructura de URLs

### Desarrollo Local
- Frontend: http://localhost:3000
- API: http://localhost:3000/api

### Producción
- Frontend: https://tu-app.vercel.app
- API: https://tu-api.railway.app

## Comandos de despliegue

### Vercel
```bash
# Despliegue automático desde Git
git push origin main

# Despliegue manual
vercel --prod
```

### Railway
```bash
# Despliegue automático desde Git
git push origin main

# Despliegue manual
railway up
```

## Monitoreo

### Vercel
- Analytics en dashboard
- Logs en tiempo real
- Métricas de rendimiento

### Railway
- Logs en tiempo real
- Métricas de recursos
- Health checks automáticos

## Troubleshooting

### Error de build en Vercel
- Verificar que todas las dependencias estén en `package.json`
- Revisar logs de build en dashboard

### Error de conexión a Railway
- Verificar variables de entorno
- Revisar logs de aplicación
- Verificar health check endpoint

### Error de base de datos
- Verificar `DATABASE_URL`
- Revisar conexión de red
- Verificar permisos de base de datos
