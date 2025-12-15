# Scripts de Migración de Certificados

Scripts para migrar certificados existentes desde la carpeta de red a Supabase Storage y PostgreSQL.

## Requisitos Previos

1. **Variables de entorno configuradas** en `.env`:
   ```env
   DATABASE_URL=postgresql://...
   SUPABASE_URL=https://kyunrotrgpnzxtpeeire.supabase.co
   SUPABASE_SERVICE_KEY=sb_secret_...
   ```

2. **Acceso a la carpeta de certificados**:
   - `G:\Shared drives\Dialfa\CERTIFICADOS DIALFA`
   - O modificar la ruta en los scripts

3. **Base de datos sincronizada**:
   ```bash
   npx prisma db push
   ```

## Scripts Disponibles

### 1. Test de Conexión (`test-migration.ts`)

Verifica que todo esté configurado correctamente antes de la migración completa.

```bash
npm run migrate:test
```

**Qué hace:**
- ✅ Verifica conexión a PostgreSQL
- ✅ Verifica conexión a Supabase Storage
- ✅ Verifica acceso a carpeta de certificados
- ✅ Sube 1 archivo de prueba
- ✅ Registra el archivo en la base de datos

**Salida esperada:**
```
🧪 Prueba de conexiones

1️⃣  Testeando PostgreSQL...
   ✅ Conectado. Certificados actuales: 0

2️⃣  Testeando Supabase Storage...
   ✅ Variables configuradas

3️⃣  Testeando acceso a carpeta de certificados...
   ✅ Carpeta accesible. Subcarpetas: 6

4️⃣  Testeando upload de archivo de prueba...
   📄 Archivo de prueba: certificado-ejemplo.pdf
   ✅ Upload exitoso: OTROS/1734567890_certificado-ejemplo.pdf
   💾 Registrado en DB: ID 1

✅ Todas las pruebas pasaron
```

---

### 2. Migración Completa (`migrate-certificates.ts`)

Migra todos los archivos de certificados.

```bash
npm run migrate:certificates
```

**Qué hace:**
1. Escanea recursivamente la carpeta `CERTIFICADOS DIALFA`
2. Identifica archivos válidos (PDF, imágenes, Excel, Word)
3. Extrae números de colada de los nombres de archivo (patrón: `\d{3,4}U\d{2}[A-Z]{1,2}`)
4. Determina la categoría basándose en la subcarpeta
5. Sube cada archivo a Supabase Storage
6. Registra metadata en PostgreSQL
7. Asocia coladas automáticamente

**Mapeo de carpetas a categorías:**
```
ACCESORIOS 2023  → ACCESORIOS
BRIDAS 2023      → BRIDAS
ESPARRAGOS 2023  → ESPARRAGOS
Forjado 2023     → FORJADO
Certificados     → OTROS
```

**Proceso:**
```
🚀 Iniciando migración de certificados...

📂 Origen: G:\Shared drives\Dialfa\CERTIFICADOS DIALFA
🗄️  Base de datos: localhost:5432
☁️  Storage: https://kyunrotrgpnzxtpeeire.supabase.co

🔍 Escaneando archivos...

✨ Encontrados 523 archivos para migrar

⚠️  ADVERTENCIA: Esta operación subirá archivos y modificará la base de datos.
Presiona Ctrl+C para cancelar, o espera 5 segundos para continuar...

▶️  Iniciando migración...

[1/523]
📄 Procesando: 2010 12 27 - 011U07GI - Nipples.pdf
  📁 Categoría: ACCESORIOS
  🔢 Coladas encontradas: 011U07GI
  ⬆️  Subiendo a Supabase...
  ✅ Subido: ACCESORIOS/1734567891_2010_12_27_-_011U07GI_-_Nipples.pdf
  💾 Registrado en DB: ID 2

[2/523]
...

============================================================
📊 RESUMEN DE MIGRACIÓN
============================================================
Total de archivos:     523
✅ Subidos exitosamente: 520
❌ Fallidos:             3
⏭️  Omitidos:             0
============================================================
```

---

## Extracción de Coladas

Los scripts extraen automáticamente números de colada de los nombres de archivo.

**Ejemplos de detección:**

| Nombre de Archivo | Coladas Detectadas |
|-------------------|-------------------|
| `2010 12 27 - 011U07GI - Nipples.pdf` | `011U07GI` |
| `2009 03 27 - 902U02GI - 804U08GI - Forjado.pdf` | `902U02GI`, `804U08GI` |
| `CERTIFICADO 805U02GI FORJADO.pdf` | `805U02GI` |
| `CERTIFICADO ACCESORIOS 20170001.jpg` | *(ninguna)* |

**Patrón regex:** `/\d{3,4}U\d{2}[A-Z]{1,2}/gi`

Si un archivo no tiene coladas en su nombre, se registrará sin coladas asociadas (puedes agregarlas manualmente después).

---

## Estructura de Datos

### Tabla `certificates`
```sql
id              BIGSERIAL PRIMARY KEY
file_name       VARCHAR(500)         -- Nombre original
storage_path    VARCHAR(1000)        -- Ruta en Supabase
original_path   VARCHAR(1000)        -- Ruta original en red
file_type       VARCHAR(50)          -- pdf, jpg, tif, etc.
file_size_bytes BIGINT
category        VARCHAR(100)         -- ACCESORIOS, BRIDAS, etc.
notes           TEXT
created_at      TIMESTAMPTZ
```

### Tabla `coladas`
```sql
id            BIGSERIAL PRIMARY KEY
colada_number VARCHAR(50) UNIQUE     -- 011U07GI, etc.
description   VARCHAR(500)
supplier      VARCHAR(200)
material_type VARCHAR(100)
created_at    TIMESTAMPTZ
```

### Tabla `certificate_coladas` (relación N:N)
```sql
certificate_id BIGINT → certificates.id
colada_id      BIGINT → coladas.id
```

---

## Troubleshooting

### Error: "No se puede acceder a carpeta"
```bash
# Verificar que la ruta es correcta
ls "G:\Shared drives\Dialfa\CERTIFICADOS DIALFA"

# Si la ruta es diferente, editar en el script:
# const CERTIFICATES_SOURCE_DIR = 'TU_RUTA_AQUI';
```

### Error: "Missing SUPABASE_URL"
```bash
# Verificar variables de entorno
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY

# Agregar al .env si faltan
```

### Error: "P1001: Can't reach database"
```bash
# Verificar que PostgreSQL esté corriendo
docker compose up postgres -d

# Verificar DATABASE_URL
echo $DATABASE_URL
```

### Migración interrumpida
Los scripts son **idempotentes**: si se interrumpen, puedes volver a ejecutarlos y solo procesarán los archivos faltantes (verifica que no haya duplicados en Supabase Storage manualmente).

---

## Siguientes Pasos

Después de migrar:

1. **Verificar en la aplicación**:
   ```
   http://localhost:3000/dashboard/certificates
   ```

2. **Agregar metadata faltante**:
   - Coladas no detectadas automáticamente
   - Descripciones de coladas
   - Proveedores y tipo de material

3. **Fase OCR** (futuro):
   - Extraer texto de PDFs/imágenes
   - Búsqueda por contenido/mercadería

---

## Personalización

Para modificar el comportamiento:

### Cambiar carpeta origen
```typescript
// En ambos scripts:
const CERTIFICATES_SOURCE_DIR = 'C:\\Tu\\Carpeta\\Aqui';
```

### Agregar más categorías
```typescript
const FOLDER_TO_CATEGORY: Record<string, string> = {
  'ACCESORIOS 2023': 'ACCESORIOS',
  'TU_CARPETA': 'TU_CATEGORIA',
  // ...
};
```

### Modificar patrón de coladas
```typescript
// En extractColadasFromFilename():
const pattern = /TU_PATRON_REGEX/gi;
```

---

## Contacto

Si encuentras problemas o necesitas ayuda, consulta los logs del script o contacta al administrador del sistema.

