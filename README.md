# Sistema de Conciliación Bancaria

Sistema completo de conciliación bancaria para Argentina que procesa archivos de ventas, compras y extractos bancarios con matching automático.

## 🚀 Características

- **Carga de archivos**: Soporte para CSV, Excel (XLSX, XLS) y PDF
- **Motor de matching**: Algoritmo inteligente de conciliación automática
- **Múltiples bancos**: Santander, BBVA, Galicia, ICBC, Macro, HSBC
- **Interfaz moderna**: Dashboard responsive con Tailwind CSS
- **Exportación**: Generación de reportes en Excel
- **Gestión de excepciones**: Bandeja para revisión manual

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 14+ con App Router, TypeScript, Tailwind CSS
- **UI**: shadcn/ui, Lucide React
- **Backend**: API Routes de Next.js
- **Storage**: Memoria (configurable para PostgreSQL)
- **Procesamiento**: ExcelJS, Papa Parse
- **Deployment**: Vercel + Railway/Supabase

## 📦 Instalación

```bash
# Clonar el repositorio
git clone <tu-repo>
cd conciliacion-bancaria

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev
```

## 🌐 Deployment

### Vercel (Frontend)

1. **Conectar repositorio a Vercel**
2. **Configurar variables de entorno**:
   ```env
   DATABASE_URL=postgresql://...
   UPLOADTHING_SECRET=...
   UPLOADTHING_APP_ID=...
   ```

3. **Deploy automático**:
   ```bash
   vercel deploy
   ```

### Railway (Base de Datos)

1. **Crear proyecto en Railway**
2. **Agregar PostgreSQL**
3. **Configurar variables de entorno**:
   ```env
   DATABASE_URL=postgresql://...
   ```

### Supabase (Alternativa)

1. **Crear proyecto en Supabase**
2. **Configurar base de datos**
3. **Obtener connection string**

## 🔧 Configuración

### Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://usuario:password@host:puerto/database

# Upload (opcional)
UPLOADTHING_SECRET=tu_secret
UPLOADTHING_APP_ID=tu_app_id

# Otros
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
```

### Bancos Soportados

- **Santander**: CSV, Excel
- **BBVA**: CSV, Excel  
- **Galicia**: CSV, Excel
- **ICBC**: CSV, Excel
- **Macro**: CSV, Excel
- **HSBC**: CSV, Excel

## 📊 Uso del Sistema

### 1. Carga de Archivos
- Sube archivos de ventas, compras y extracto bancario
- Selecciona el banco y período
- El sistema valida automáticamente los formatos

### 2. Procesamiento
- Motor de matching inteligente
- Conciliación por importe, fecha, CBU, CUIT
- Tolerancia configurable para fechas y montos

### 3. Resultados
- Dashboard con estadísticas
- Tabla detallada de movimientos
- Exportación a Excel
- Gestión de excepciones

## 🏗️ Arquitectura

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Páginas del dashboard
│   └── api/              # API Routes
├── components/            # Componentes React
│   ├── dashboard/        # Layout y navegación
│   ├── conciliacion/     # Componentes específicos
│   └── ui/              # shadcn/ui components
├── lib/                  # Lógica de negocio
│   ├── engine/          # Motor de conciliación
│   ├── storage/         # Adaptadores de storage
│   └── types/           # Tipos TypeScript
└── prisma/              # Schema de base de datos
```

## 🔄 Flujo de Conciliación

1. **Carga**: Usuario sube 3 archivos (ventas, compras, extracto)
2. **Validación**: Sistema valida formatos y estructura
3. **Normalización**: Conversión a formato canónico
4. **Matching**: Algoritmo de conciliación automática
5. **Resultados**: Dashboard con estadísticas y detalles
6. **Exportación**: Generación de reportes Excel

## 🎯 Reglas de Matching

- **Importe exacto**: Coincidencia exacta de montos
- **Tolerancia de fecha**: ±3 días por defecto
- **CBU/CUIT**: Coincidencia de contrapartes
- **Referencias**: Matching por códigos de referencia
- **Fuzzy matching**: Algoritmo de similitud para texto

## 📈 Próximas Funcionalidades

- [ ] Integración con PostgreSQL
- [ ] Autenticación de usuarios
- [ ] Historial de conciliaciones
- [ ] Reglas de matching configurables
- [ ] Notificaciones por email
- [ ] API REST completa
- [ ] Mobile app

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.

## 🆘 Soporte

Para soporte técnico o consultas:
- Email: soporte@conciliacion.com
- Issues: GitHub Issues
- Documentación: Wiki del proyecto

---

**Desarrollado con ❤️ para Argentina**