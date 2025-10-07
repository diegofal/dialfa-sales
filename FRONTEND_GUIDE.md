# SPISA Frontend - Guía de Usuario

**Fecha:** Octubre 7, 2025  
**Estado:** ✅ Completado y Funcionando

---

## 🚀 Iniciar la Aplicación

### Método Rápido (Recomendado)
```bash
# Windows
start-all.bat

# Linux/macOS/Git Bash
./start-all.sh
```

### Método Manual

#### Backend (API)
```bash
cd backend/src/Spisa.WebApi
dotnet run
```
**URL:** http://localhost:5021  
**Swagger:** http://localhost:5021/swagger

#### Frontend (Next.js)
```bash
cd frontend
npm run dev
```
**URL:** http://localhost:3000

**📖 Guía completa:** Ver `START_GUIDE.md`

---

## 🔑 Credenciales de Acceso

### Usuario Administrador
- **Usuario:** `admin`
- **Contraseña:** `admin123`
- **Rol:** ADMIN

### Usuario Regular
- **Usuario:** `user`
- **Contraseña:** `user123`
- **Rol:** USER

---

## 📱 Funcionalidades Implementadas

### ✅ Autenticación
- Login con JWT
- Protección de rutas
- Persistencia de sesión (localStorage)
- Logout con redirect

### ✅ Dashboard
- Estadísticas generales del sistema
- Acceso rápido a módulos
- Datos en tiempo real de la base de datos

### ✅ Módulo de Clientes (CRUD Completo)

#### Ver Lista de Clientes
1. Click en "Clientes" en el sidebar
2. Ver tabla con 397 clientes migrados
3. Información mostrada:
   - Código
   - Razón Social
   - CUIT
   - Ciudad
   - Saldo actual (con formato de moneda)
   - Estado (Activo/Inactivo)

#### Crear Nuevo Cliente
1. Click en botón "Nuevo Cliente"
2. Completar formulario:
   - **Código*** (requerido)
   - **Razón Social*** (requerido)
   - CUIT
   - Domicilio
   - Ciudad
   - Código Postal
   - Teléfono
   - Email
   - **Condición IVA*** (requerido, número 1-6)
   - **Tipo de Operatoria*** (requerido, número 1-3)
3. Click en "Crear"
4. Notificación de éxito
5. Lista se actualiza automáticamente

#### Editar Cliente
1. Click en botón "Editar" (✏️) en la fila del cliente
2. Modificar campos necesarios
3. Click en "Actualizar"
4. Cambios guardados y lista actualizada

#### Eliminar Cliente
1. Click en botón "Eliminar" (🗑️) en la fila del cliente
2. Confirmar en el diálogo
3. Cliente eliminado (soft delete)
4. Lista actualizada automáticamente

### ✅ Módulo de Categorías (CRUD Completo)

#### Ver Lista de Categorías
1. Click en "Categorías" en el sidebar
2. Ver tabla con 12 categorías migradas
3. Información mostrada:
   - Código
   - Nombre
   - Descripción
   - Descuento por defecto (%)
   - Cantidad de artículos
   - Estado (Activa/Eliminada)

#### Crear Nueva Categoría
1. Click en botón "Nueva Categoría"
2. Completar formulario:
   - **Código*** (requerido, máx. 20 caracteres)
   - **Nombre*** (requerido, máx. 100 caracteres)
   - Descripción (opcional, máx. 500 caracteres)
   - Descuento por defecto (%, 0-100)
3. Click en "Crear"
4. Notificación de éxito
5. Lista se actualiza automáticamente

#### Editar Categoría
1. Click en botón "Editar" (✏️) en la fila de la categoría
2. Modificar campos necesarios
3. Click en "Actualizar"
4. Cambios guardados y lista actualizada

#### Eliminar Categoría
1. Click en botón "Eliminar" (🗑️) en la fila de la categoría
2. Confirmar en el diálogo
3. Categoría eliminada (soft delete)
4. Los artículos asociados no se eliminan
5. Lista actualizada automáticamente

---

## 🎨 Navegación

### Sidebar (Menú Lateral)
- **Dashboard** - Página principal ✅
- **Clientes** - Gestión de clientes ✅
- **Categorías** - Gestión de categorías ✅
- **Artículos** - Próximamente
- **Pedidos** - Próximamente
- **Facturas** - Próximamente
- **Remitos** - Próximamente
- **Reportes** - Próximamente
- **Configuración** - Próximamente

### Navbar (Barra Superior)
- Título del sistema
- Dropdown de usuario:
  - Ver nombre de usuario
  - Ver rol
  - Cerrar sesión

---

## 🛠️ Tecnologías Utilizadas

### Frontend Stack
- **Framework:** Next.js 14 (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** TailwindCSS
- **Componentes:** shadcn/ui
- **State Management:** 
  - Server State: React Query (@tanstack/react-query)
  - Client State: Zustand
- **Formularios:** React Hook Form + Zod
- **HTTP Client:** Axios (con interceptors JWT)
- **Notificaciones:** Sonner

### Backend Stack
- **.NET:** 8.0 (LTS)
- **Arquitectura:** Clean Architecture + DDD
- **Patrón:** CQRS con MediatR
- **Base de Datos:** PostgreSQL 16
- **ORM:** Entity Framework Core 8
- **Autenticación:** JWT Bearer Tokens
- **Validación:** FluentValidation
- **Logging:** Serilog

---

## 📊 Datos del Sistema

### Base de Datos PostgreSQL
- **Host:** localhost:5432
- **Database:** spisa
- **Registros Migrados:** 268,817
  - Categorías: 12 ✅
  - Clientes: 397 ✅
  - Artículos: 1,797
  - Pedidos: 39,065
  - Facturas: 32,575
  - Remitos: 27,636
  - Otros: ~165,000

---

## 🔍 Características Técnicas

### Autenticación JWT
- Token generado en el backend
- Almacenado en localStorage
- Enviado automáticamente en cada request (Bearer Token)
- Expiración: 60 minutos
- Auto-logout al expirar

### API REST
- Endpoints RESTful
- Validación de datos en backend
- Manejo de errores consistente
- Respuestas en JSON
- Documentación Swagger

### UI/UX
- Diseño responsivo (funciona en mobile)
- Notificaciones toast para feedback
- Confirmaciones para acciones destructivas
- Validación en tiempo real de formularios
- Loading states en todas las operaciones

---

## 🐛 Troubleshooting

### El login no funciona
- Verificar que el backend esté corriendo (http://localhost:5021/health)
- Usar credenciales correctas: admin/admin123
- Verificar consola del navegador para errores

### No veo los datos de clientes
- Verificar que PostgreSQL esté corriendo (Docker)
- Verificar migración de datos completada
- Abrir DevTools → Network → Ver requests

### Error 401 Unauthorized
- Token expiró → Hacer logout y login nuevamente
- Token inválido → Limpiar localStorage del navegador

### Frontend no inicia
```bash
cd frontend
rm -rf node_modules .next
npm install
npm run dev
```

### Backend no inicia
```bash
cd backend/src/Spisa.WebApi
dotnet clean
dotnet build
dotnet run
```

---

## 📝 Comandos Útiles

### Desarrollo
```bash
# Frontend
npm run dev          # Servidor de desarrollo
npm run build        # Build para producción
npm run start        # Servidor de producción
npm run lint         # Linter

# Backend
dotnet run           # Ejecutar API
dotnet watch run     # Hot reload
dotnet build         # Compilar
dotnet test          # Tests (cuando se implementen)
```

### Base de Datos
```bash
# PostgreSQL (Docker)
docker compose up -d postgres
docker compose down
docker compose logs postgres

# Conectar con psql
docker compose exec postgres psql -U spisa_user -d spisa
```

---

## 🎯 Próximos Módulos a Implementar

### 1. Módulo de Artículos (4-5 horas)
- Backend: CRUD de artículos + gestión de stock
- Frontend: Lista con búsqueda y filtros
- Asociación con categorías (dropdown)
- Indicadores de stock bajo

### 2. Módulo de Pedidos (6-8 horas)
- Backend: Crear/listar pedidos
- Frontend: Wizard de creación
- Selección de cliente y artículos
- Cálculo de totales

### 3. Mejoras de UI (2-3 horas)
- Filtros en tabla de clientes y categorías
- Búsqueda en tiempo real
- Paginación
- Exportar a Excel/PDF

---

**¡El sistema está listo para usar!** 🚀

*Última actualización: Octubre 7, 2025*





