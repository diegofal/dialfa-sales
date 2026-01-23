/**
 * Script de migración de certificados
 *
 * Sube todos los archivos de certificados desde la carpeta local
 * a Supabase Storage y registra su metadata en PostgreSQL.
 *
 * Uso:
 *   npx tsx scripts/migrate-certificates.ts
 *
 * Variables de entorno requeridas:
 *   - DATABASE_URL
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import {
  uploadCertificateFile,
  getFileExtension,
  isAllowedFileType,
} from '../lib/storage/supabase';

// Configuración
const CERTIFICATES_SOURCE_DIR = 'G:\\Shared drives\\Dialfa\\CERTIFICADOS DIALFA';
const EXCEL_FILE_PATH = 'C:\\Users\\User\\Desktop\\Certificados.xlsx';

// Mapeo de carpetas a categorías
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

const prisma = new PrismaClient();

// Estadísticas de migración
interface MigrationStats {
  totalFiles: number;
  uploaded: number;
  failed: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
}

const stats: MigrationStats = {
  totalFiles: 0,
  uploaded: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

/**
 * Lee el archivo Excel y construye un mapa de archivos → coladas
 */
async function loadExcelMapping(): Promise<Map<string, string[]>> {
  const fileToColadas = new Map<string, string[]>();

  try {
    console.log('📊 Leyendo archivo Excel...\n');

    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    let currentFile = '';

    for (const row of data) {
      const fileName = row['NOMBRE DEL ARCHIVO  ']; // Nota: columna tiene espacios
      const colada = row['COLADA'];

      // Si hay nombre de archivo, actualizar el archivo actual
      if (fileName && fileName.toString().trim()) {
        currentFile = fileName.toString().trim();
        if (!fileToColadas.has(currentFile)) {
          fileToColadas.set(currentFile, []);
        }
      }

      // Si hay colada, agregarla al archivo actual
      if (colada && colada.toString().trim() && currentFile) {
        const coladaStr = colada.toString().trim();
        const existing = fileToColadas.get(currentFile);
        if (existing && !existing.includes(coladaStr)) {
          existing.push(coladaStr);
        }
      }
    }

    console.log(`✅ Excel cargado: ${fileToColadas.size} archivos con coladas definidas\n`);

    return fileToColadas;
  } catch (error) {
    console.warn('⚠️  No se pudo leer el Excel, se usará extracción de nombres de archivo');
    console.warn(`   Error: ${error}\n`);
    return new Map();
  }
}

/**
 * Extrae números de colada de un nombre de archivo
 * Busca patrones como: 011U07GI, 805U02GI, etc.
 */
function extractColadasFromFilename(filename: string): string[] {
  const coladas: string[] = [];

  // Patrón: números + letra + números + letras (ej: 011U07GI)
  const pattern = /\d{3,4}U\d{2}[A-Z]{1,2}/gi;
  const matches = filename.match(pattern);

  if (matches) {
    coladas.push(...matches.map((m) => m.toUpperCase()));
  }

  return [...new Set(coladas)]; // Eliminar duplicados
}

/**
 * Obtiene la categoría basándose en la ruta del archivo
 */
function getCategoryFromPath(filePath: string): string {
  const relativePath = filePath.replace(CERTIFICATES_SOURCE_DIR, '');
  const parts = relativePath.split(path.sep).filter(Boolean);

  if (parts.length > 0) {
    const folder = parts[0];
    return FOLDER_TO_CATEGORY[folder] || 'ACCESORIOS';
  }

  return 'ACCESORIOS';
}

/**
 * Escanea recursivamente un directorio y retorna todos los archivos
 */
async function scanDirectory(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursión en subdirectorios
        const subFiles = await scanDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Solo archivos permitidos
        if (isAllowedFileType(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error escaneando ${dir}:`, error);
  }

  return files;
}

/**
 * Crea o encuentra una colada en la base de datos
 */
async function findOrCreateColada(coladaNumber: string) {
  return prisma.coladas.upsert({
    where: { colada_number: coladaNumber },
    create: { colada_number: coladaNumber },
    update: {},
  });
}

/**
 * Migra un archivo individual
 */
async function migrateFile(
  filePath: string,
  excelMapping: Map<string, string[]>
): Promise<boolean> {
  const fileName = path.basename(filePath);

  try {
    console.log(`\n📄 Procesando: ${fileName}`);

    // Verificar si ya existe en la base de datos
    const existing = await prisma.certificates.findFirst({
      where: {
        file_name: fileName,
        deleted_at: null,
      },
    });

    if (existing) {
      console.log(`  ⏭️  Ya existe en la base de datos (ID: ${existing.id})`);
      stats.skipped++;
      return true;
    }

    // Leer archivo
    const fileBuffer = await fs.readFile(filePath);
    const category = getCategoryFromPath(filePath);

    console.log(`  📁 Categoría: ${category}`);

    // Obtener coladas: primero del Excel, luego del nombre de archivo
    let coladaNumbers: string[] = [];
    let source = '';

    if (excelMapping.has(fileName)) {
      coladaNumbers = excelMapping.get(fileName)!;
      source = 'Excel';
    } else {
      coladaNumbers = extractColadasFromFilename(fileName);
      source = 'nombre de archivo';
    }

    console.log(
      `  🔢 Coladas (${source}): ${coladaNumbers.length > 0 ? coladaNumbers.join(', ') : 'ninguna'}`
    );

    // Subir a Supabase Storage
    console.log(`  ⬆️  Subiendo a Supabase...`);
    const { storagePath } = await uploadCertificateFile(fileBuffer, fileName, category);

    console.log(`  ✅ Subido: ${storagePath}`);

    // Crear/obtener coladas
    const coladas = await Promise.all(coladaNumbers.map((num) => findOrCreateColada(num)));

    // Registrar en base de datos
    const certificate = await prisma.certificates.create({
      data: {
        file_name: fileName,
        storage_path: storagePath,
        original_path: filePath,
        file_type: getFileExtension(fileName),
        file_size_bytes: BigInt(fileBuffer.length),
        category,
        certificate_coladas: {
          create: coladas.map((colada) => ({
            colada_id: colada.id,
          })),
        },
      },
    });

    console.log(`  💾 Registrado en DB: ID ${certificate.id}`);
    stats.uploaded++;
    return true;
  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    stats.failed++;
    stats.errors.push({
      file: fileName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Script principal
 */
async function main() {
  console.log('🚀 Iniciando migración de certificados...\n');
  console.log(`📂 Origen: ${CERTIFICATES_SOURCE_DIR}`);
  console.log(`🗄️  Base de datos: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);
  console.log(`☁️  Storage: ${process.env.SUPABASE_URL}\n`);

  // Verificar que el directorio existe
  try {
    await fs.access(CERTIFICATES_SOURCE_DIR);
  } catch {
    console.error(`❌ No se puede acceder a: ${CERTIFICATES_SOURCE_DIR}`);
    process.exit(1);
  }

  // Cargar mapeo del Excel
  const excelMapping = await loadExcelMapping();

  // Escanear todos los archivos
  console.log('🔍 Escaneando archivos...');
  const files = await scanDirectory(CERTIFICATES_SOURCE_DIR);
  stats.totalFiles = files.length;

  console.log(`\n✨ Encontrados ${stats.totalFiles} archivos para migrar\n`);
  console.log('='.repeat(60));

  // Confirmar antes de proceder
  console.log('\n⚠️  ADVERTENCIA: Esta operación subirá archivos y modificará la base de datos.');
  console.log('Presiona Ctrl+C para cancelar, o espera 5 segundos para continuar...\n');

  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log('▶️  Iniciando migración...\n');

  // Migrar cada archivo
  for (let i = 0; i < files.length; i++) {
    console.log(`\n[${i + 1}/${files.length}]`);
    await migrateFile(files[i], excelMapping);

    // Pausa pequeña para evitar rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(60));
  console.log(`Total de archivos:     ${stats.totalFiles}`);
  console.log(`✅ Subidos exitosamente: ${stats.uploaded}`);
  console.log(`❌ Fallidos:             ${stats.failed}`);
  console.log(`⏭️  Omitidos:             ${stats.skipped}`);
  console.log('='.repeat(60));

  if (stats.errors.length > 0) {
    console.log('\n❌ ERRORES:');
    stats.errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err.file}`);
      console.log(`   ${err.error}\n`);
    });
  }

  console.log('\n✅ Migración completada');
}

// Ejecutar script
main()
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
