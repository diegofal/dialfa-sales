# SPISA - Herramientas de Calidad de Código

## 1. Herramientas Actuales

### 1.1 Estado Actual

| Herramienta | Estado | Configuración |
|-------------|--------|---------------|
| **TypeScript** | ✅ Activo | `tsconfig.json` con strict mode |
| **ESLint** | ✅ Activo | `eslint.config.mjs` |
| **Next.js Lint** | ✅ Activo | Integrado |
| **Prettier** | ❌ No configurado | Falta |
| **Husky** | ❌ No configurado | Pre-commit hooks faltantes |
| **Lint-staged** | ❌ No configurado | Falta |
| **Jest** | ❌ No configurado | Tests faltantes |
| **Commitlint** | ❌ No configurado | Falta |
| **SonarQube** | ❌ No configurado | Análisis estático faltante |

### 1.2 Evaluación

**Fortalezas:**
- ✅ TypeScript en modo estricto
- ✅ ESLint configurado

**Debilidades:**
- ❌ No hay formateo automático (Prettier)
- ❌ No hay pre-commit hooks
- ❌ No hay análisis de calidad continuo
- ❌ No hay testing automatizado

---

## 2. Prettier - Formateo de Código

### 2.1 Instalación

```bash
npm install -D prettier eslint-config-prettier
```

### 2.2 Configuración

**Crear `.prettierrc.json`:**
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 80,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSpacing": true,
  "jsxSingleQuote": false,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Crear `.prettierignore`:**
```
.next
node_modules
dist
build
coverage
*.log
.env*
package-lock.json
```

### 2.3 Integración con ESLint

**Actualizar `eslint.config.mjs`:**
```javascript
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  // ... existing config
  eslintConfigPrettier, // Debe ser el último
]
```

### 2.4 Scripts

**Agregar a `package.json`:**
```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### 2.5 VSCode Integration

**Crear `.vscode/settings.json`:**
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## 3. Husky + Lint-staged - Pre-commit Hooks

### 3.1 Instalación

```bash
npm install -D husky lint-staged
npx husky install
npm pkg set scripts.prepare="husky install"
```

### 3.2 Configuración de Lint-staged

**Crear `.lintstagedrc.json`:**
```json
{
  "*.{js,jsx,ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ],
  "*.{ts,tsx}": [
    "bash -c 'npm run type-check'"
  ]
}
```

### 3.3 Pre-commit Hook

```bash
npx husky add .husky/pre-commit "npx lint-staged"
```

**Contenido de `.husky/pre-commit`:**
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

### 3.4 Pre-push Hook (Tests)

```bash
npx husky add .husky/pre-push "npm test"
```

**Contenido de `.husky/pre-push`:**
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm test
```

---

## 4. Commitlint - Conventional Commits

### 4.1 Instalación

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

### 4.2 Configuración

**Crear `commitlint.config.js`:**
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Nueva funcionalidad
        'fix',      // Bug fix
        'docs',     // Documentación
        'style',    // Formateo
        'refactor', // Refactorización
        'perf',     // Performance
        'test',     // Tests
        'chore',    // Mantenimiento
        'ci',       // CI/CD
        'revert',   // Revert
      ],
    ],
    'subject-case': [0], // Permite cualquier case
    'subject-max-length': [2, 'always', 100],
  },
}
```

### 4.3 Commit-msg Hook

```bash
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit ${1}'
```

### 4.4 Ejemplos de Commits Válidos

```bash
# ✅ Válido
git commit -m "feat: add user authentication"
git commit -m "fix: resolve null pointer in articles table"
git commit -m "docs: update API documentation"

# ❌ Inválido
git commit -m "Added stuff"
git commit -m "WIP"
git commit -m "fix bug"
```

---

## 5. ESLint - Reglas Adicionales

### 5.1 Plugins Recomendados

```bash
npm install -D \
  eslint-plugin-import \
  eslint-plugin-jsx-a11y \
  eslint-plugin-react-hooks \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser
```

### 5.2 Configuración Mejorada

**Actualizar `eslint.config.mjs`:**
```javascript
import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import next from '@next/eslint-plugin-next'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@typescript-eslint': typescript,
      'import': importPlugin,
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
      '@next/next': next,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Import
      'import/order': ['error', {
        'groups': [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        'alphabetize': {
          'order': 'asc',
          'caseInsensitive': true,
        },
      }],
      'import/no-duplicates': 'error',
      'import/no-cycle': 'warn',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Accessibility
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/anchor-is-valid': 'error',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
    ],
  },
]
```

---

## 6. TypeScript - Configuración Estricta

### 6.1 Mejorar `tsconfig.json`

```json
{
  "compilerOptions": {
    // Strict checks (ya configurados ✅)
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Additional checks (agregar 🆕)
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    // Module resolution
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,

    // Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,

    // Other
    "skipLibCheck": true,
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

---

## 7. Jest - Testing Framework

### 7.1 Instalación

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jest-environment-jsdom @types/jest \
  ts-jest
```

### 7.2 Configuración

**Crear `jest.config.js`:**
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

**Crear `jest.setup.js`:**
```javascript
import '@testing-library/jest-dom'
```

### 7.3 Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

## 8. SonarQube - Análisis Estático

### 8.1 Docker Compose

**Agregar a `docker-compose.yml`:**
```yaml
services:
  sonarqube:
    image: sonarqube:community
    ports:
      - "9000:9000"
    environment:
      - SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_logs:/opt/sonarqube/logs
      - sonarqube_extensions:/opt/sonarqube/extensions

volumes:
  sonarqube_data:
  sonarqube_logs:
  sonarqube_extensions:
```

### 8.2 Configuración

**Crear `sonar-project.properties`:**
```properties
sonar.projectKey=spisa
sonar.projectName=SPISA
sonar.projectVersion=1.0

sonar.sources=app,components,lib
sonar.tests=__tests__

sonar.sourceEncoding=UTF-8
sonar.javascript.lcov.reportPaths=coverage/lcov.info

sonar.exclusions=**/node_modules/**,**/*.test.ts,**/*.test.tsx
```

### 8.3 Script de Análisis

```json
{
  "scripts": {
    "sonar": "sonar-scanner"
  }
}
```

---

## 9. Dependency Cruiser - Análisis de Dependencias

### 9.1 Instalación

```bash
npm install -D dependency-cruiser
```

### 9.2 Configuración

**Crear `.dependency-cruiser.js`:**
```javascript
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies allowed',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'No orphaned modules',
      from: {
        orphan: true,
      },
      to: {},
    },
    {
      name: 'no-deprecated-core',
      severity: 'warn',
      comment: 'No deprecated Node.js core modules',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: '^(punycode|domain|constants|sys|_linklist)$',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },
  },
}
```

### 9.3 Scripts

```json
{
  "scripts": {
    "deps:check": "depcruise --validate .dependency-cruiser.js app components lib",
    "deps:graph": "depcruise --include-only '^(app|components|lib)' --output-type dot app components lib | dot -T svg > dependency-graph.svg"
  }
}
```

---

## 10. Bundle Analyzer

### 10.1 Instalación

```bash
npm install -D @next/bundle-analyzer
```

### 10.2 Configuración

**Actualizar `next.config.ts`:**
```typescript
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer({
  // ... rest of config
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-dialog',
    ],
  },
})
```

### 10.3 Script

```json
{
  "scripts": {
    "analyze": "ANALYZE=true npm run build"
  }
}
```

---

## 11. Madge - Visualización de Dependencias

### 11.1 Instalación

```bash
npm install -D madge
```

### 11.2 Scripts

```json
{
  "scripts": {
    "madge:circular": "madge --circular --extensions ts,tsx app components lib",
    "madge:graph": "madge --image dependency-graph.svg --extensions ts,tsx app"
  }
}
```

---

## 12. Size-limit - Límite de Bundle Size

### 12.1 Instalación

```bash
npm install -D @size-limit/preset-app
```

### 12.2 Configuración

**Crear `.size-limit.json`:**
```json
[
  {
    "name": "Client bundle",
    "path": ".next/static/**/*.js",
    "limit": "300 KB"
  }
]
```

### 12.3 Script

```json
{
  "scripts": {
    "size": "npm run build && size-limit"
  }
}
```

---

## 13. Herramientas VSCode Recomendadas

### 13.1 Extensions

**Crear `.vscode/extensions.json`:**
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-playwright.playwright",
    "orta.vscode-jest",
    "streetsidesoftware.code-spell-checker",
    "usernamehw.errorlens"
  ]
}
```

### 13.2 Settings

**`.vscode/settings.json`:**
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "cSpell.words": [
    "spisa",
    "prisma",
    "zustand",
    "shadcn",
    "pdfkit"
  ]
}
```

---

## 14. Scripts Completos Recomendados

**`package.json`:**
```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "analyze": "ANALYZE=true npm run build",
    "deps:check": "depcruise --validate .dependency-cruiser.js app components lib",
    "deps:audit": "npm audit",
    "deps:update": "npx npm-check-updates -u",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "sonar": "sonar-scanner",
    "prepare": "husky install",
    "validate": "npm run type-check && npm run lint && npm run test",
    "ci": "npm run validate && npm run build"
  }
}
```

---

## 15. Pre-commit Workflow Completo

### 15.1 Flujo

```
Developer commits
    ↓
Husky pre-commit hook
    ↓
Lint-staged runs
    ├─ ESLint (auto-fix)
    ├─ Prettier (format)
    └─ TypeScript check
    ↓
If all pass → Commit succeeds
If any fail → Commit rejected
    ↓
Developer fixes issues
    ↓
Commit again
```

### 15.2 Pre-push Workflow

```
Developer pushes
    ↓
Husky pre-push hook
    ↓
Run tests
    ├─ Unit tests
    ├─ Integration tests
    └─ Coverage check
    ↓
If all pass → Push succeeds
If any fail → Push rejected
```

---

## 16. CI Workflow

### 16.1 GitHub Actions

**`.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Check dependencies
        run: npm run deps:check

      - name: Security audit
        run: npm audit --audit-level=moderate

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/coverage-final.json

      - name: Build
        run: npm run build

      - name: Check bundle size
        run: npm run size
```

---

## 17. Quality Metrics Dashboard

### 17.1 Métricas a Monitorear

| Métrica | Herramienta | Objetivo |
|---------|-------------|----------|
| **Code Coverage** | Jest | > 80% |
| **Type Coverage** | TypeScript | 100% |
| **Lint Errors** | ESLint | 0 |
| **Formatting** | Prettier | 100% |
| **Bundle Size** | Next.js Analyzer | < 300KB |
| **Build Time** | Next.js | < 60s |
| **Circular Dependencies** | Madge | 0 |
| **Security Vulnerabilities** | npm audit | 0 high/critical |
| **Code Duplication** | SonarQube | < 3% |
| **Technical Debt** | SonarQube | < 5% |

---

## 18. Resumen de Implementación

### 18.1 Prioridad Alta (Implementar primero)

1. ✅ **Prettier** - Formateo consistente
2. ✅ **Husky + Lint-staged** - Pre-commit hooks
3. ✅ **Jest** - Testing framework
4. ✅ **Commitlint** - Conventional commits
5. ✅ **GitHub Actions** - CI pipeline

### 18.2 Prioridad Media

6. ✅ **ESLint rules** - Mejorar configuración
7. ✅ **TypeScript strict** - Más strict checks
8. ✅ **Bundle Analyzer** - Optimizar bundle size
9. ✅ **Dependency Cruiser** - Verificar dependencias

### 18.3 Prioridad Baja

10. ✅ **SonarQube** - Análisis estático avanzado
11. ✅ **Size-limit** - Control de bundle size
12. ✅ **Madge** - Visualización de dependencias

---

## 19. Beneficios Esperados

### 19.1 Calidad de Código
- ✅ Código consistente y formateado
- ✅ Sin errores de linting
- ✅ Type-safe al 100%
- ✅ Sin código muerto

### 19.2 Mantenibilidad
- ✅ Fácil de leer y entender
- ✅ Fácil de refactorizar
- ✅ Fácil de testear
- ✅ Documentación generada

### 19.3 Productividad
- ✅ Menos bugs en producción
- ✅ Faster onboarding
- ✅ Automated workflows
- ✅ Confidence en cambios

### 19.4 Escalabilidad
- ✅ Base sólida para crecer
- ✅ Patrones establecidos
- ✅ Herramientas en su lugar
- ✅ Best practices implementadas

---

**Conclusión**: Implementar estas herramientas transformará el proyecto en un **codebase de clase mundial** con estándares de calidad profesionales.
