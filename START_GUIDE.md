# 🚀 SPISA - Guía de Inicio Rápido

## 📋 Requisitos Previos

Antes de iniciar, asegúrate de tener:

- ✅ PostgreSQL corriendo en Docker (`docker-compose up -d`)
- ✅ .NET 8 SDK instalado
- ✅ Node.js 18+ instalado
- ✅ Git Bash (para scripts .sh en Windows)

---

## 🪟 Windows (Recomendado)

### Opción 1: Iniciar Todo Automáticamente

Haz doble clic en:
```
start-all.bat
```

Esto abrirá **2 ventanas**:
1. Backend API (puerto 5021)
2. Frontend App (puerto 3000)

### Opción 2: Iniciar Manualmente

**Terminal 1 - Backend:**
```batch
start-backend.bat
```

**Terminal 2 - Frontend:**
```batch
start-frontend.bat
```

---

## 🐧 Linux / macOS / Git Bash

### Opción 1: Iniciar Todo Automáticamente

```bash
./start-all.sh
```

### Opción 2: Iniciar Manualmente

**Terminal 1 - Backend:**
```bash
./start-backend.sh
```

**Terminal 2 - Frontend:**
```bash
./start-frontend.sh
```

---

## 🎯 Verificar que Todo Funciona

Después de iniciar los servicios:

### 1. Backend API
- **URL:** http://localhost:5021
- **Swagger:** http://localhost:5021/swagger
- **Health Check:** http://localhost:5021/health

**Test rápido:**
```bash
curl http://localhost:5021/health
# Respuesta esperada: {"status":"healthy","timestamp":"..."}
```

### 2. Frontend App
- **URL:** http://localhost:3000
- **Login:** http://localhost:3000/login

**Credenciales:**
- Usuario: `admin`
- Contraseña: `admin123`

---

## 🛑 Detener los Servicios

### Windows
- Presiona `Ctrl+C` en cada ventana
- O simplemente cierra las ventanas

### Linux / macOS / Git Bash
- Presiona `Ctrl+C` (detendrá ambos servicios si usaste `start-all.sh`)

---

## 📊 Módulos Disponibles

Una vez logueado, tienes acceso a:

| Módulo | URL | Estado |
|--------|-----|--------|
| Dashboard | `/dashboard` | ✅ Funcionando |
| Clientes | `/dashboard/clients` | ✅ Funcionando (397 registros) |
| Categorías | `/dashboard/categories` | ✅ Funcionando (12 registros) |
| Artículos | `/dashboard/articles` | ⏭️ Próximamente |
| Pedidos | `/dashboard/orders` | ⏭️ Próximamente |

---

## 🐛 Solución de Problemas

### Backend no inicia

**Error:** `The SDK 'Microsoft.NET.Sdk' specified could not be found`
**Solución:** Instala .NET 8 SDK desde https://dotnet.microsoft.com/download

**Error:** `Failed to bind to address http://localhost:5021`
**Solución:** El puerto 5021 está ocupado. Detén otros procesos:
```bash
# Windows
netstat -ano | findstr :5021
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :5021
kill -9 <PID>
```

### Frontend no inicia

**Error:** `command not found: npm`
**Solución:** Instala Node.js desde https://nodejs.org/

**Error:** `Port 3000 is already in use`
**Solución:** 
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :3000
kill -9 <PID>
```

### Categorías no aparecen en el Frontend

**Causa:** Falta el archivo `.env.local`
**Solución:**
```bash
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:5021" > .env.local
# Reinicia el frontend
```

### Error de conexión a PostgreSQL

**Solución:** Inicia Docker Compose:
```bash
cd database
docker-compose up -d
```

Verifica que PostgreSQL esté corriendo:
```bash
docker ps | grep postgres
```

---

## 📁 Estructura de Scripts

```
spisa-new/
├── start-all.bat          # Windows: Inicia todo
├── start-backend.bat      # Windows: Solo backend
├── start-frontend.bat     # Windows: Solo frontend
├── start-all.sh           # Unix: Inicia todo
├── start-backend.sh       # Unix: Solo backend
└── start-frontend.sh      # Unix: Solo frontend
```

---

## 🔗 Enlaces Útiles

- **Swagger UI:** http://localhost:5021/swagger
- **Frontend:** http://localhost:3000
- **pgAdmin:** http://localhost:5050 (si está configurado)
- **Documentación:** Ver `README.md`
- **Estado de Migración:** Ver `MIGRATION_STATUS.md`

---

## 💡 Consejos

1. **Siempre inicia el Backend primero** (tarda ~5 segundos)
2. **Luego inicia el Frontend** (tarda ~10 segundos)
3. **Usa `start-all.bat`** para mayor comodidad
4. **Mantén las ventanas abiertas** mientras trabajas
5. **Verifica los logs** si algo no funciona

---

## ✅ Todo Listo

Si siguiste todos los pasos, deberías ver:

```
✅ Backend API corriendo en http://localhost:5021
✅ Frontend App corriendo en http://localhost:3000
✅ PostgreSQL con 268,817 registros migrados
✅ 2 módulos funcionales (Clientes + Categorías)
```

**¡A trabajar!** 🎉



