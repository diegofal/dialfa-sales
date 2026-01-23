# Guía de Commits - Conventional Commits

Este proyecto usa **Conventional Commits** con validación automática via commitlint.

## Formato básico

```
<type>(<scope>): <subject en minúsculas>

<body opcional - máx 150 caracteres por línea>

<footer opcional>
```

## Types más comunes

| Type | Uso | Ejemplo |
|------|-----|---------|
| `feat` | Nueva funcionalidad | `feat(ui): add supplier dialog` |
| `fix` | Corrección de bug | `fix(api): correct price rounding` |
| `refactor` | Refactorización | `refactor(hooks): use factory pattern` |
| `chore` | Mantenimiento/config | `chore(deps): update dependencies` |
| `docs` | Documentación | `docs: update API documentation` |
| `style` | Formato código | `style: format with prettier` |
| `test` | Tests | `test: add supplier validation tests` |
| `perf` | Performance | `perf(db): optimize article queries` |

## Scopes comunes

**Frontend:**
- `ui` - Componentes visuales
- `hooks` - React hooks
- `api` - Cliente API
- `pages` - Páginas/rutas
- `types` - Definiciones TypeScript

**Backend/DB:**
- `db` - Base de datos/Prisma
- `auth` - Autenticación
- `validation` - Schemas Zod

**Otros:**
- `config` - Configuración
- `deps` - Dependencias

## Reglas importantes

✅ **HACER:**
- Subject en minúsculas: `add feature`
- Usar imperativo: `add` (no `added` o `adds`)
- Máximo 100 caracteres en subject
- Máximo 150 caracteres por línea en body
- Línea en blanco entre subject y body

❌ **NO HACER:**
- Capitalizar: ~~`Add feature`~~
- Pasado: ~~`added feature`~~
- Punto final: ~~`add feature.`~~
- Subject muy largo: ~~`add new feature that does many things...`~~

## Ejemplos correctos

### Commit simple
```bash
git commit -m "feat(ui): add supplier management dialog"
```

### Commit con body
```bash
git commit -m "$(cat <<'EOF'
fix(api): correct price calculation in bulk updates

Fixed rounding errors when updating multiple prices at once.
Now uses decimal precision for currency calculations.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

### Breaking change
```bash
git commit -m "$(cat <<'EOF'
feat(api): redesign authentication flow

BREAKING CHANGE: JWT tokens now expire after 24 hours instead of 7 days.
Users will need to re-authenticate more frequently.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

## Usando el skill `/commit`

La forma más fácil es usar el skill que automatiza todo:

```bash
# Generar commit automáticamente
/commit

# Con mensaje personalizado
/commit fix login bug

# Desde Cursor o terminal
git add .
/commit
```

El skill:
1. ✅ Analiza tus cambios
2. ✅ Genera el mensaje correcto
3. ✅ Valida el formato
4. ✅ Crea el commit
5. ✅ Maneja errores de commitlint

## Si commitlint falla

### Error: "subject-case"
```
✖ subject must not be sentence-case, start-case, pascal-case, upper-case
```
**Solución:** Usar minúsculas
- ❌ `Feat: Add feature`
- ✅ `feat: add feature`

### Error: "body-max-line-length"
```
✖ body's lines must not be longer than 150 characters
```
**Solución:** Partir líneas largas
```bash
# ❌ Malo
git commit -m "feat: add feature

This is a very long line that exceeds the maximum length allowed by commitlint configuration and needs to be split"

# ✅ Bueno
git commit -m "feat: add feature

This is a very long line that exceeds the maximum length allowed
by commitlint configuration and needs to be split"
```

### Error: "type-empty"
```
✖ type may not be empty
```
**Solución:** Agregar tipo
- ❌ `add feature`
- ✅ `feat: add feature`

## Quick Reference

```bash
# 1. Stagear cambios
git add <archivos>

# 2. Crear commit (opción 1: usar skill)
/commit

# 2. Crear commit (opción 2: manual)
git commit -m "type(scope): subject lowercase"

# 3. Si falla, leer error y ajustar
# commitlint te dirá exactamente qué está mal

# 4. Verificar commit
git log -1

# 5. Push
git push
```

## Configuración actual

El proyecto tiene commitlint configurado con:
- Body line length: **150 caracteres**
- Subject case: **flexible** (pero mejor usar lowercase)
- Subject max length: **100 caracteres**

Puedes ver la config completa en: `frontend/commitlint.config.js`
