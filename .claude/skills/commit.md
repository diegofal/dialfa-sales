# Commit Skill

**Command:** `/commit [mensaje-opcional]`

**Description:** Crea un commit siguiendo las convenciones del proyecto (Conventional Commits) con validación automática de commitlint.

## Instructions

Este skill automatiza la creación de commits siguiendo el estándar **Conventional Commits** configurado en el proyecto.

## Conventional Commits Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types permitidos:
- **feat**: Nueva funcionalidad
- **fix**: Corrección de bug
- **docs**: Cambios en documentación
- **style**: Formateo, punto y coma, etc (no afecta código)
- **refactor**: Refactorización de código
- **perf**: Mejoras de performance
- **test**: Agregar o corregir tests
- **chore**: Cambios en build, herramientas, etc
- **ci**: Cambios en CI/CD
- **build**: Cambios en sistema de build

### Reglas de formato:
1. **Subject**:
   - Máximo 100 caracteres
   - Usar imperativo ("add", no "added" o "adds")
   - No capitalizar primera letra (lowercase)
   - No punto al final
   - Ser descriptivo y conciso

2. **Body**:
   - Líneas máximo 150 caracteres
   - Separar del subject con línea en blanco
   - Explicar QUÉ y POR QUÉ (no el cómo)
   - Opcional pero recomendado para cambios complejos

3. **Footer**:
   - Breaking changes: `BREAKING CHANGE: descripción`
   - Referencias: `Refs #123`, `Closes #456`
   - Co-authors: `Co-Authored-By: Name <email>`

## Process Flow

### 1. Analizar cambios
```bash
git status
git diff --staged
git log --oneline -5
```

Ejecuta estos comandos en paralelo para entender:
- Qué archivos fueron modificados
- Qué cambios específicos se hicieron
- Estilo de commits recientes del proyecto

### 2. Determinar tipo y alcance

Basándote en los archivos modificados:

**Frontend changes:**
- `frontend/components/` → `feat(ui)` o `fix(ui)`
- `frontend/lib/api/` → `feat(api)` o `fix(api)`
- `frontend/lib/hooks/` → `feat(hooks)` o `refactor(hooks)`
- `frontend/app/` → `feat(pages)` o `fix(pages)`
- `frontend/types/` → `feat(types)` o `refactor(types)`

**Backend/Database changes:**
- `prisma/schema.prisma` → `feat(db)` o `chore(db)`
- `prisma/migrations/` → `chore(db)`

**Configuration:**
- `.claude/`, `tsconfig.json`, etc → `chore(config)`
- Tests → `test`
- Documentation → `docs`

### 3. Generar mensaje de commit

Analiza los cambios y genera un mensaje siguiendo este template:

```
<type>(<scope>): <subject descriptivo>

<body explicando el qué y por qué>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Ejemplos buenos:**

```
feat(ui): add supplier management dialog

Implemented a new dialog component for creating and editing suppliers.
Includes form validation with Zod and React Hook Form integration.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

```
fix(api): correct price calculation in bulk updates

Fixed rounding errors when updating multiple prices at once.
Now uses decimal precision for currency calculations.

Closes #123
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

```
refactor(hooks): migrate to factory pattern for CRUD operations

Replaced individual hook definitions with createCRUDHooks factory.
Reduces code duplication and improves maintainability.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Ejemplos malos:**

```
❌ Feat: Add new feature (capitalizado)
❌ feat: added supplier dialog (pasado, debe ser imperativo)
❌ feat: stuff (no descriptivo)
❌ update files (sin tipo)
❌ feat(ui): Este es un cambio que agrega una nueva funcionalidad para... (más de 100 caracteres)
```

### 4. Crear el commit

Si el usuario proporcionó un mensaje:
- Valida que siga el formato
- Corrígelo si es necesario
- Crea el commit

Si no proporcionó mensaje:
- Genera uno automáticamente basado en los cambios
- Muéstraselo al usuario para aprobación
- Crea el commit

**Formato del comando:**

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

### 5. Validación post-commit

Después del commit:
```bash
git log -1 --pretty=format:"%h - %s"
```

Confirma al usuario que el commit fue exitoso.

## Common Scenarios

### Escenario 1: Usuario dice "commit this" o solo "/commit"
1. Analiza cambios staged
2. Genera mensaje automático
3. Muestra el mensaje propuesto
4. Pregunta confirmación
5. Crea commit

### Escenario 2: Usuario dice "/commit fix bug in login"
1. Analiza cambios
2. Formatea como: `fix(auth): correct bug in login flow`
3. Agrega body descriptivo si es necesario
4. Crea commit

### Escenario 3: Usuario da mensaje completo
1. Valida formato
2. Ajusta si es necesario
3. Crea commit

## Important Notes

- **ALWAYS** follow the lowercase convention for subject
- **ALWAYS** keep body lines under 150 characters
- **ALWAYS** use imperative mood ("add" not "added")
- **ALWAYS** include Co-Authored-By footer
- **NEVER** skip the type(scope) prefix
- **NEVER** use sentence case in subject
- **Review** git status BEFORE committing
- **Stage** files first if needed

## Error Handling

Si commitlint falla:
1. Lee el mensaje de error
2. Identifica qué regla se violó
3. Corrige el mensaje
4. Reintenta el commit

Si hay archivos sin stagear y el usuario quiere commitear:
1. Pregunta qué archivos agregar
2. Ejecuta `git add <files>`
3. Procede con el commit

## Examples by File Type

**New entity created:**
```
feat(entities): add supplier management module

Implemented complete CRUD for suppliers including:
- Type definitions and validation schemas
- API endpoints with authentication
- React components and hooks
- Admin dashboard page

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Bug fix:**
```
fix(api): prevent duplicate entries in price history

Added unique constraint check before inserting price changes.
Prevents race condition when multiple users update prices.

Closes #456
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Configuration change:**
```
chore(config): update commitlint rules for flexibility

Increased body line length to 150 chars and disabled strict
subject-case validation to support various commit styles.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Refactoring:**
```
refactor(db): optimize article queries with eager loading

Reduced N+1 queries by including category relations.
Improves list page load time by ~60%.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Start Flow

When this skill is invoked:

1. Check git status for staged files
2. If no staged files, ask user what to stage
3. Analyze changes in staged files
4. Generate or validate commit message
5. Create commit with proper format
6. Confirm success

Let's begin! 🚀
