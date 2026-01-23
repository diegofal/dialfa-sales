# Guía de Mantenimiento de Documentación

## 🎯 Objetivo

Mantener la documentación **100% sincronizada** con el código. Cada cambio arquitectónico debe reflejarse inmediatamente en la documentación.

---

## 📋 Regla de Oro

> **"Si cambias el código, DEBES actualizar la documentación en el mismo commit"**

---

## 🗂️ Mapeo: Código → Documentación

### Cuando Modificas...

#### 1. **Arquitectura del Proyecto**

**Cambios que afectan:**
- Agregar/eliminar capas
- Cambiar stack tecnológico
- Modificar patrones arquitectónicos
- Cambiar flujo de datos

**Documentos a actualizar:**
- ✅ `docs/architecture-overview.md`
  - Sección: Stack Tecnológico
  - Sección: Arquitectura de Capas
  - Sección: Patrones de Diseño
- ✅ `docs/components-interaction.md`
  - Mapa de interacciones
  - Flujos de datos

**Ejemplo:**
```bash
# Si agregaste Repository pattern
1. Editar docs/architecture-overview.md
   - Agregar "Capa de Repositorios" en arquitectura
2. Editar docs/components-interaction.md
   - Actualizar flujo de datos con capa de repositorios
3. Commit todo junto
   git commit -m "refactor: add repository pattern

   Updated docs/architecture-overview.md with repository layer
   Updated docs/components-interaction.md with new data flow"
```

---

#### 2. **Estructura de Carpetas**

**Cambios que afectan:**
- Crear/mover/eliminar carpetas
- Cambiar organización de archivos
- Agregar nuevas convenciones

**Documentos a actualizar:**
- ✅ `docs/folder-structure-analysis.md`
  - Sección: Estructura Actual
  - Sección: Análisis por Capa

**Ejemplo:**
```bash
# Si creaste carpeta types/
1. Editar docs/folder-structure-analysis.md
   - Agregar "types/" en estructura actual
   - Actualizar score si mejora la organización
2. Commit
   git commit -m "feat: add centralized types folder

   Updated docs/folder-structure-analysis.md with types/ structure"
```

---

#### 3. **Flujos de Interacción**

**Cambios que afectan:**
- Modificar cómo se comunican componentes
- Cambiar flujo de autenticación
- Agregar/modificar middleware
- Cambiar gestión de estado

**Documentos a actualizar:**
- ✅ `docs/components-interaction.md`
  - Flujos de casos de uso
  - Diagramas de interacción

**Ejemplo:**
```bash
# Si modificaste el flujo de crear artículo
1. Editar docs/components-interaction.md
   - Actualizar "2.1 Crear un Artículo"
2. Commit
   git commit -m "refactor: extract article creation to service

   Updated docs/components-interaction.md with new flow"
```

---

#### 4. **Implementar Mejora Propuesta**

**Cambios que afectan:**
- Implementar item de improvement-opportunities.md
- Agregar herramienta de calidad
- Refactorizar según SOLID

**Documentos a actualizar:**
- ✅ `docs/improvement-opportunities.md`
  - Marcar como implementado ✅
  - Actualizar estado
- ✅ `docs/code-quality-tools.md` (si aplica)
  - Marcar herramienta como implementada
- ✅ `docs/solid-principles-analysis.md` (si aplica)
  - Actualizar análisis de principio

**Ejemplo:**
```bash
# Si implementaste Jest
1. Editar docs/improvement-opportunities.md
   - Cambiar "❌ No hay tests" a "✅ Tests implementados"
2. Editar docs/code-quality-tools.md
   - Actualizar sección Jest con "✅ Implementado"
3. Commit
   git commit -m "feat: add Jest testing framework

   - Configured Jest with React Testing Library
   - Added first test suite for services
   - Updated docs/improvement-opportunities.md
   - Updated docs/code-quality-tools.md"
```

---

#### 5. **Agregar Nueva Feature**

**Cambios que afectan:**
- Nuevo módulo completo
- Nuevas API routes
- Nuevos componentes

**Documentos a actualizar:**
- ✅ `docs/architecture-overview.md`
  - Sección: Componentes Principales
  - Sección: API Routes
- ✅ `docs/folder-structure-analysis.md`
  - Estructura actual

**Ejemplo:**
```bash
# Si agregaste módulo de "proveedores"
1. Editar docs/architecture-overview.md
   - Agregar en "Componentes Principales"
   - Agregar en "API Routes"
2. Editar docs/folder-structure-analysis.md
   - Agregar carpeta components/suppliers/
   - Agregar ruta app/api/suppliers/
3. Commit
   git commit -m "feat: add suppliers module

   - Created suppliers CRUD
   - Added API routes
   - Updated architecture docs"
```

---

## 🔄 Workflow de Actualización

### Paso a Paso

```
1. Hacer cambios en código
   ↓
2. Identificar qué docs se afectan (ver tabla arriba)
   ↓
3. Abrir archivos de docs correspondientes
   ↓
4. Actualizar secciones específicas
   ↓
5. Verificar que todo es consistente
   ↓
6. Commit código + docs juntos
   ↓
7. En mensaje de commit, mencionar docs actualizados
```

### Mensaje de Commit Ideal

```bash
git commit -m "feat: add repository pattern for articles

- Created IArticleRepository interface
- Implemented PrismaArticleRepository
- Refactored ArticleService to use repository
- Added tests for repository

Docs updated:
- architecture-overview.md: Added repository layer
- components-interaction.md: Updated data flow
- solid-principles-analysis.md: Marked DIP as implemented"
```

---

## 📝 Checklist Pre-Commit

Antes de hacer commit, verificar:

- [ ] ¿Cambié estructura de carpetas?
  - [ ] ✅ Actualicé `folder-structure-analysis.md`

- [ ] ¿Cambié arquitectura/patrones?
  - [ ] ✅ Actualicé `architecture-overview.md`
  - [ ] ✅ Actualicé `components-interaction.md`

- [ ] ¿Implementé mejora propuesta?
  - [ ] ✅ Marqué en `improvement-opportunities.md`
  - [ ] ✅ Actualicé doc correspondiente

- [ ] ¿Agregué herramienta de calidad?
  - [ ] ✅ Actualicé `code-quality-tools.md`

- [ ] ¿Refactoricé según SOLID?
  - [ ] ✅ Actualicé `solid-principles-analysis.md`

- [ ] ¿Agregué nueva feature/módulo?
  - [ ] ✅ Actualicé `architecture-overview.md`
  - [ ] ✅ Actualicé `folder-structure-analysis.md`

---

## 🛠️ Herramientas de Ayuda

### 1. Script de Verificación

**Crear `scripts/check-docs.sh`:**
```bash
#!/bin/bash

# Verifica que la documentación esté actualizada

echo "🔍 Verificando documentación..."

# Verificar que docs existen
DOCS=(
  "docs/architecture-overview.md"
  "docs/components-interaction.md"
  "docs/folder-structure-analysis.md"
  "docs/improvement-opportunities.md"
  "docs/code-quality-tools.md"
  "docs/solid-principles-analysis.md"
)

for doc in "${DOCS[@]}"; do
  if [ ! -f "$doc" ]; then
    echo "❌ Falta: $doc"
    exit 1
  fi
done

echo "✅ Todos los documentos existen"

# Verificar que docs fueron modificados recientemente (últimos 7 días)
LAST_CODE_CHANGE=$(git log -1 --format=%ct -- "app/" "components/" "lib/")
LAST_DOC_CHANGE=$(git log -1 --format=%ct -- "docs/")

DIFF=$((LAST_CODE_CHANGE - LAST_DOC_CHANGE))
DAYS=$((DIFF / 86400))

if [ $DAYS -gt 7 ]; then
  echo "⚠️  Advertencia: Documentación no actualizada en $DAYS días"
  echo "   Última modificación de código: $(date -d @$LAST_CODE_CHANGE)"
  echo "   Última modificación de docs: $(date -d @$LAST_DOC_CHANGE)"
  echo ""
  echo "   Por favor, verificar que la documentación esté actualizada"
fi

echo "✅ Verificación completa"
```

**Agregar a package.json:**
```json
{
  "scripts": {
    "docs:check": "bash scripts/check-docs.sh"
  }
}
```

---

### 2. Git Hook para Recordatorio

**Crear `.husky/pre-commit-docs`:**
```bash
#!/bin/sh

# Verificar si hay cambios en código pero no en docs
CODE_FILES=$(git diff --cached --name-only | grep -E "^(app|components|lib)/")
DOC_FILES=$(git diff --cached --name-only | grep "^docs/")

if [ -n "$CODE_FILES" ] && [ -z "$DOC_FILES" ]; then
  echo ""
  echo "⚠️  RECORDATORIO: Modificaste código pero no actualizaste documentación"
  echo ""
  echo "Archivos de código modificados:"
  echo "$CODE_FILES" | sed 's/^/  - /'
  echo ""
  echo "Por favor, verifica si necesitas actualizar:"
  echo "  - docs/architecture-overview.md"
  echo "  - docs/components-interaction.md"
  echo "  - docs/folder-structure-analysis.md"
  echo "  - docs/improvement-opportunities.md"
  echo "  - docs/code-quality-tools.md"
  echo "  - docs/solid-principles-analysis.md"
  echo ""

  # No bloquear, solo advertir
  read -p "¿Continuar sin actualizar docs? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

**Integrar en `.husky/pre-commit`:**
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged

# Verificar documentación
bash .husky/pre-commit-docs
```

---

### 3. Template de PR

**Crear `.github/pull_request_template.md`:**
```markdown
## Descripción

<!-- Describe los cambios realizados -->

## Tipo de cambio

- [ ] Bug fix
- [ ] Nueva feature
- [ ] Refactorización
- [ ] Cambio de arquitectura
- [ ] Actualización de dependencias

## Checklist

### Código
- [ ] Tests agregados/actualizados
- [ ] Código pasa lint y type-check
- [ ] Sin console.logs

### Documentación
- [ ] Actualicé `architecture-overview.md` (si aplica)
- [ ] Actualicé `components-interaction.md` (si aplica)
- [ ] Actualicé `folder-structure-analysis.md` (si aplica)
- [ ] Actualicé `improvement-opportunities.md` (si aplica)
- [ ] Actualicé `code-quality-tools.md` (si aplica)
- [ ] Actualicé `solid-principles-analysis.md` (si aplica)

### Si NO actualizaste docs, explica por qué:
<!-- Ej: "Solo cambié estilos CSS, no afecta arquitectura" -->

## Screenshots (si aplica)

<!-- Agregar screenshots de cambios visuales -->
```

---

## 📊 Responsabilidades por Tipo de Cambio

| Tipo de Cambio | Docs a Actualizar | Tiempo Estimado |
|----------------|-------------------|-----------------|
| **Agregar carpeta/archivo** | `folder-structure-analysis.md` | 5 min |
| **Cambiar arquitectura** | `architecture-overview.md`, `components-interaction.md` | 15-30 min |
| **Implementar mejora** | `improvement-opportunities.md` + doc específica | 10-20 min |
| **Agregar herramienta** | `code-quality-tools.md` | 10-15 min |
| **Refactorizar SOLID** | `solid-principles-analysis.md` | 15-20 min |
| **Nueva feature completa** | Múltiples docs | 30-60 min |
| **Solo estilos/CSS** | Ninguno | 0 min |

---

## 🎨 Formato y Estilo

### Markdown

**Usar:**
- Headers: `#`, `##`, `###`
- Listas: `-`, `1.`
- Code blocks: ` ```typescript `
- Emojis para estados: ✅ ❌ ⚠️ 🔴 🟡 🟢
- Tablas para comparaciones

**Ejemplo de actualización:**

```markdown
### 2.1 Estado Actual

**Antes:**
- ❌ No hay tests

**Después:**
- ✅ Tests implementados con Jest
- ✅ Cobertura: 65%
- ⚠️ Falta agregar E2E tests
```

---

## 🔍 Review de Documentación

### Checklist para Reviewer

Al revisar PR, verificar:

- [ ] ¿Los cambios de código están reflejados en docs?
- [ ] ¿La documentación sigue siendo precisa?
- [ ] ¿Se mantiene el estilo consistente?
- [ ] ¿Los diagramas/flujos están actualizados?
- [ ] ¿Los checkboxes están marcados correctamente?
- [ ] ¿Las estimaciones/scores están actualizados?

**Si NO se actualizó documentación:**
- Solicitar actualización antes de aprobar PR
- O verificar que realmente no era necesario

---

## 📅 Mantenimiento Periódico

### Mensual

- [ ] Revisar todos los docs
- [ ] Verificar que ejemplos de código sigan siendo válidos
- [ ] Actualizar scores/métricas
- [ ] Verificar links internos

### Por Sprint

- [ ] Actualizar `IMPLEMENTATION_PLAN.md` con progreso
- [ ] Marcar tareas completadas
- [ ] Ajustar estimaciones si es necesario

### Por Release

- [ ] Actualizar versión en `README.md`
- [ ] Revisar arquitectura completa
- [ ] Generar changelog

---

## 🚨 Qué Hacer si Docs Quedan Desactualizadas

Si detectas que la documentación no está sincronizada:

### 1. Crear Issue

```markdown
**Título:** [DOCS] Documentación desactualizada en [archivo]

**Descripción:**
La documentación en `docs/[archivo].md` no refleja el estado actual del código.

**Sección afectada:** [nombre de sección]

**Cambios necesarios:**
- [ ] Actualizar [X]
- [ ] Agregar [Y]
- [ ] Eliminar [Z]

**Código relacionado:**
- `app/[...]`
- `lib/[...]`

**Prioridad:** Alta/Media/Baja
```

### 2. Asignar y Resolver Rápido

- Prioridad ALTA si afecta arquitectura
- Resolver en máximo 2 días
- Commit con prefijo `docs:`

### 3. Post-Mortem

- ¿Por qué no se actualizó?
- ¿Cómo evitarlo en el futuro?
- ¿Mejorar hooks/scripts?

---

## 💡 Tips

### ✅ Buenas Prácticas

1. **Actualizar docs en el mismo commit que el código**
2. **Usar mensajes de commit descriptivos**
3. **Revisar docs antes de abrir PR**
4. **Marcar checkboxes cuando completes tareas**
5. **Usar emojis para estados (✅ ❌ ⚠️)**

### ❌ Evitar

1. **Commits de docs separados (excepto fix de typos)**
2. **Dejar TODOs en documentación**
3. **Copiar/pegar código que puede quedar obsoleto**
4. **Documentar implementación interna excesiva**

---

## 📖 Ejemplos Reales

### Ejemplo 1: Implementar Repository Pattern

**Cambios de código:**
```
+ lib/repositories/interfaces.ts
+ lib/repositories/prisma/ArticleRepository.ts
+ lib/repositories/prisma/ClientRepository.ts
~ lib/services/articleService.ts (usa repository)
```

**Documentación a actualizar:**

1. `docs/architecture-overview.md`:
```diff
## 3. Arquitectura de Capas

+ ├─────────────────────────────────────────────────────┤
+ │              CAPA DE REPOSITORIOS                   │
+ │  - Interfaces: lib/repositories/interfaces.ts       │
+ │  - Implementaciones: lib/repositories/prisma/       │
  ├─────────────────────────────────────────────────────┤
```

2. `docs/solid-principles-analysis.md`:
```diff
### 1.5 Dependency Inversion Principle (DIP)

- ⚠️ Violaciones de DIP Detectadas
+ ✅ Aspectos que Cumplen DIP

- **Problema en Services:**
+ **Solución Implementada:**

+ // Interfaces en lib/repositories/interfaces.ts
+ export interface IArticleRepository {
+   findById(id: number): Promise<Article | null>
+ }
```

3. `docs/improvement-opportunities.md`:
```diff
| 4 | **DIP** | Dependencia directa de Prisma | `lib/services/*.ts` |
- Implementar Repository pattern |
+ ✅ Implementado |
```

**Commit:**
```bash
git commit -m "refactor: implement repository pattern for articles and clients

- Created repository interfaces in lib/repositories/interfaces.ts
- Implemented PrismaArticleRepository and PrismaClientRepository
- Refactored services to depend on repository abstractions
- Added tests for repositories

Docs updated:
- architecture-overview.md: Added repository layer diagram
- solid-principles-analysis.md: Marked DIP as implemented
- improvement-opportunities.md: Marked DIP task as complete"
```

---

### Ejemplo 2: Agregar Tests

**Cambios de código:**
```
+ jest.config.js
+ jest.setup.js
+ lib/services/__tests__/activityLogger.test.ts
+ lib/services/__tests__/abcClassification.test.ts
```

**Documentación a actualizar:**

1. `docs/code-quality-tools.md`:
```diff
| **Jest** |
- ❌ No configurado | Tests faltantes |
+ ✅ Activo | `jest.config.js` |
```

2. `docs/improvement-opportunities.md`:
```diff
## 1. Testing (Prioridad: CRÍTICA 🔴)

### 1.1 Estado Actual
- ❌ **No hay tests unitarios**
+ ✅ **Tests unitarios implementados**
+ ✅ Cobertura actual: 45%
+ ⚠️ Objetivo: 80%
```

**Commit:**
```bash
git commit -m "test: add Jest with initial test suites

- Configured Jest with React Testing Library
- Added tests for activityLogger service
- Added tests for abcClassification service
- Current coverage: 45%

Docs updated:
- code-quality-tools.md: Marked Jest as implemented
- improvement-opportunities.md: Updated testing status"
```

---

## ✅ Resumen

**Reglas simples:**

1. 🔄 Código + Docs = 1 Commit
2. 📝 Usa el checklist pre-commit
3. ✅ Marca tareas completadas
4. 🎯 Manten sincronía 100%
5. 🚀 La documentación es código

**Recuerda:**

> "Documentación desactualizada es peor que no tener documentación"

---

**Próximos pasos:**
1. Leer esta guía completamente
2. Configurar hooks sugeridos
3. Practicar con primer cambio
4. ¡Mantener disciplina! 💪
