/**
 * Script de análisis de certificados
 *
 * Escanea la carpeta de certificados y genera un reporte
 * sin subir nada ni modificar la base de datos.
 *
 * Útil para:
 * - Ver cuántos archivos hay
 * - Verificar tipos de archivo
 * - Detectar coladas
 * - Revisar la estructura antes de migrar
 *
 * Uso:
 *   npx tsx scripts/scan-certificates.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const CERTIFICATES_SOURCE_DIR = 'G:\\Shared drives\\Dialfa\\CERTIFICADOS DIALFA';

interface FileInfo {
  path: string;
  name: string;
  category: string;
  extension: string;
  size: number;
  coladas: string[];
}

interface CategoryStats {
  count: number;
  totalSize: number;
  extensions: Record<string, number>;
}

const FOLDER_TO_CATEGORY: Record<string, string> = {
  'ACCESORIOS 2023': 'ACCESORIOS',
  ACCESORIOS: 'ACCESORIOS',
  'BRIDAS 2023': 'BRIDAS',
  BRIDAS: 'BRIDAS',
  'ESPARRAGOS 2023': 'ESPARRAGOS',
  ESPARRAGOS: 'ESPARRAGOS',
  'Forjado 2023': 'FORJADO',
  FORJADO: 'FORJADO',
  Certificados: 'ACCESORIOS',
};

function extractColadasFromFilename(filename: string): string[] {
  const coladas: string[] = [];
  const pattern = /\d{3,4}U\d{2}[A-Z]{1,2}/gi;
  const matches = filename.match(pattern);

  if (matches) {
    coladas.push(...matches.map((m) => m.toUpperCase()));
  }

  return [...new Set(coladas)];
}

function getCategoryFromPath(filePath: string): string {
  const relativePath = filePath.replace(CERTIFICATES_SOURCE_DIR, '');
  const parts = relativePath.split(path.sep).filter(Boolean);

  if (parts.length > 0) {
    const folder = parts[0];
    return FOLDER_TO_CATEGORY[folder] || 'ACCESORIOS';
  }

  return 'ACCESORIOS';
}

function isAllowedFile(filename: string): boolean {
  const allowedExtensions = [
    'pdf',
    'jpg',
    'jpeg',
    'png',
    'gif',
    'tif',
    'tiff',
    'bmp',
    'xls',
    'xlsx',
    'doc',
    'docx',
  ];
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return allowedExtensions.includes(ext);
}

async function scanDirectory(dir: string, files: FileInfo[] = []): Promise<FileInfo[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, files);
      } else if (entry.isFile() && isAllowedFile(entry.name)) {
        const stats = await fs.stat(fullPath);

        files.push({
          path: fullPath,
          name: entry.name,
          category: getCategoryFromPath(fullPath),
          extension: entry.name.split('.').pop()?.toLowerCase() || '',
          size: stats.size,
          coladas: extractColadasFromFilename(entry.name),
        });
      }
    }
  } catch (error) {
    console.error(`Error escaneando ${dir}:`, error);
  }

  return files;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  console.log('🔍 Escaneando carpeta de certificados...\n');
  console.log(`📂 Origen: ${CERTIFICATES_SOURCE_DIR}\n`);

  // Verificar acceso
  try {
    await fs.access(CERTIFICATES_SOURCE_DIR);
  } catch {
    console.error(`❌ No se puede acceder a: ${CERTIFICATES_SOURCE_DIR}`);
    process.exit(1);
  }

  // Escanear
  const files = await scanDirectory(CERTIFICATES_SOURCE_DIR);

  // Estadísticas por categoría
  const categoryStats: Record<string, CategoryStats> = {};
  const coladasSet = new Set<string>();
  const extensionsTotal: Record<string, number> = {};

  for (const file of files) {
    // Por categoría
    if (!categoryStats[file.category]) {
      categoryStats[file.category] = {
        count: 0,
        totalSize: 0,
        extensions: {},
      };
    }
    categoryStats[file.category].count++;
    categoryStats[file.category].totalSize += file.size;
    categoryStats[file.category].extensions[file.extension] =
      (categoryStats[file.category].extensions[file.extension] || 0) + 1;

    // Extensiones totales
    extensionsTotal[file.extension] = (extensionsTotal[file.extension] || 0) + 1;

    // Coladas únicas
    file.coladas.forEach((c) => coladasSet.add(c));
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  // Reporte
  console.log('='.repeat(70));
  console.log('📊 REPORTE DE ESCANEO');
  console.log('='.repeat(70));
  console.log(`\n📁 Total de archivos:     ${files.length}`);
  console.log(`💾 Tamaño total:          ${formatBytes(totalSize)}`);
  console.log(`🔢 Coladas únicas:        ${coladasSet.size}`);
  console.log(`📦 Archivos con coladas:  ${files.filter((f) => f.coladas.length > 0).length}`);
  console.log(`❓ Archivos sin coladas:  ${files.filter((f) => f.coladas.length === 0).length}\n`);

  // Por categoría
  console.log('='.repeat(70));
  console.log('📂 POR CATEGORÍA');
  console.log('='.repeat(70));

  Object.entries(categoryStats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([category, stats]) => {
      console.log(`\n${category}:`);
      console.log(`  Archivos: ${stats.count}`);
      console.log(`  Tamaño:   ${formatBytes(stats.totalSize)}`);
      console.log(
        `  Tipos:    ${Object.entries(stats.extensions)
          .map(([ext, count]) => `${ext}(${count})`)
          .join(', ')}`
      );
    });

  // Por extensión
  console.log('\n' + '='.repeat(70));
  console.log('📄 POR TIPO DE ARCHIVO');
  console.log('='.repeat(70) + '\n');

  Object.entries(extensionsTotal)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ext, count]) => {
      const percentage = ((count / files.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor((count / files.length) * 50));
      console.log(`${ext.padEnd(6)} ${count.toString().padStart(4)} (${percentage}%) ${bar}`);
    });

  // Top 10 archivos más grandes
  console.log('\n' + '='.repeat(70));
  console.log('📦 TOP 10 ARCHIVOS MÁS GRANDES');
  console.log('='.repeat(70) + '\n');

  files
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .forEach((file, i) => {
      console.log(
        `${(i + 1).toString().padStart(2)}. ${formatBytes(file.size).padStart(8)} - ${file.name}`
      );
      console.log(`    ${file.category}`);
    });

  // Archivos sin colada (muestra)
  const withoutColadas = files.filter((f) => f.coladas.length === 0);

  if (withoutColadas.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log(
      `⚠️  ARCHIVOS SIN COLADA DETECTADA (mostrando ${Math.min(10, withoutColadas.length)} de ${withoutColadas.length})`
    );
    console.log('='.repeat(70) + '\n');

    withoutColadas.slice(0, 10).forEach((file) => {
      console.log(`📄 ${file.name}`);
      console.log(`   ${file.category}\n`);
    });
  }

  // Top coladas
  const coladasCount: Record<string, number> = {};
  files.forEach((file) => {
    file.coladas.forEach((colada) => {
      coladasCount[colada] = (coladasCount[colada] || 0) + 1;
    });
  });

  const topColadas = Object.entries(coladasCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topColadas.length > 0) {
    console.log('='.repeat(70));
    console.log('🔢 TOP 10 COLADAS MÁS FRECUENTES');
    console.log('='.repeat(70) + '\n');

    topColadas.forEach(([colada, count], i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${colada.padEnd(12)} - ${count} archivo(s)`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Escaneo completado\n');
  console.log('Próximos pasos:');
  console.log('  1. Revisar el reporte');
  console.log('  2. Probar con: npm run migrate:test');
  console.log('  3. Migrar todo: npm run migrate:certificates\n');
}

main().catch(console.error);
