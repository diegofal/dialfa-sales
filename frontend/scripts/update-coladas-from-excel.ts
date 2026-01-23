/**
 * Script para actualizar las coladas de certificados existentes
 * basándose en el archivo Excel
 *
 * Este script NO sube archivos, solo actualiza las relaciones con coladas
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const EXCEL_PATH = 'C:\\Users\\User\\Desktop\\Certificados.xlsx';
const prisma = new PrismaClient();

interface Stats {
  total: number;
  updated: number;
  notInExcel: number;
  newColadas: number;
  errors: Array<{ file: string; error: string }>;
}

const stats: Stats = {
  total: 0,
  updated: 0,
  notInExcel: 0,
  newColadas: 0,
  errors: [],
};

/**
 * Lee el archivo Excel y construye un mapa de archivos → coladas
 */
async function loadExcelMapping(): Promise<Map<string, string[]>> {
  const fileToColadas = new Map<string, string[]>();

  try {
    console.log('📊 Leyendo archivo Excel...\n');

    const workbook = XLSX.readFile(EXCEL_PATH);
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

    console.log(`✅ Excel cargado: ${fileToColadas.size} archivos mapeados\n`);

    return fileToColadas;
  } catch (error) {
    console.error('❌ Error leyendo Excel:', error);
    throw error;
  }
}

/**
 * Crea o encuentra una colada en la base de datos
 */
async function findOrCreateColada(coladaNumber: string) {
  const existing = await prisma.coladas.findUnique({
    where: { colada_number: coladaNumber },
  });

  if (existing) {
    return existing;
  }

  stats.newColadas++;
  return prisma.coladas.create({
    data: { colada_number: coladaNumber },
  });
}

/**
 * Actualiza las coladas de un certificado
 */
async function updateCertificateColadas(
  certificateId: bigint,
  fileName: string,
  coladaNumbers: string[]
): Promise<boolean> {
  try {
    // Eliminar relaciones existentes
    await prisma.certificate_coladas.deleteMany({
      where: { certificate_id: certificateId },
    });

    if (coladaNumbers.length === 0) {
      return true;
    }

    // Crear o encontrar coladas
    const coladas = await Promise.all(coladaNumbers.map((num) => findOrCreateColada(num)));

    // Crear nuevas relaciones
    await prisma.certificate_coladas.createMany({
      data: coladas.map((colada) => ({
        certificate_id: certificateId,
        colada_id: colada.id,
      })),
    });

    return true;
  } catch (error) {
    console.error(
      `  ❌ Error actualizando: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
  console.log('🔄 Actualizando coladas desde Excel...\n');

  try {
    // Cargar mapeo del Excel
    const excelMapping = await loadExcelMapping();

    // Obtener todos los certificados de la base de datos
    console.log('📂 Obteniendo certificados de la base de datos...\n');
    const certificates = await prisma.certificates.findMany({
      select: {
        id: true,
        file_name: true,
        certificate_coladas: {
          include: {
            colada: true,
          },
        },
      },
    });

    stats.total = certificates.length;
    console.log(`✅ ${stats.total} certificados encontrados\n`);
    console.log('='.repeat(60));

    // Procesar cada certificado
    for (let i = 0; i < certificates.length; i++) {
      const cert = certificates[i];

      console.log(`\n[${i + 1}/${certificates.length}] ${cert.file_name}`);

      // Verificar si está en el Excel
      if (excelMapping.has(cert.file_name)) {
        const coladaNumbers = excelMapping.get(cert.file_name)!;
        const currentColadas = cert.certificate_coladas.map((cc) => cc.colada.colada_number);

        // Comparar coladas
        const needsUpdate =
          coladaNumbers.length !== currentColadas.length ||
          !coladaNumbers.every((num) => currentColadas.includes(num));

        if (needsUpdate) {
          console.log(
            `  📊 Coladas Excel: ${coladaNumbers.length > 0 ? coladaNumbers.join(', ') : 'ninguna'}`
          );
          console.log(
            `  📊 Coladas actuales: ${currentColadas.length > 0 ? currentColadas.join(', ') : 'ninguna'}`
          );
          console.log(`  🔄 Actualizando...`);

          const success = await updateCertificateColadas(cert.id, cert.file_name, coladaNumbers);
          if (success) {
            console.log(`  ✅ Actualizado`);
            stats.updated++;
          }
        } else {
          console.log(`  ⏭️  Ya tiene las coladas correctas`);
        }
      } else {
        console.log(`  ⚠️  No encontrado en Excel (mantiene coladas actuales)`);
        stats.notInExcel++;
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`Total de certificados:       ${stats.total}`);
    console.log(`✅ Actualizados:              ${stats.updated}`);
    console.log(
      `⏭️  Sin cambios/No en Excel:   ${stats.notInExcel + (stats.total - stats.updated - stats.notInExcel)}`
    );
    console.log(`🆕 Nuevas coladas creadas:    ${stats.newColadas}`);
    console.log(`❌ Errores:                   ${stats.errors.length}`);
    console.log('='.repeat(60));

    if (stats.errors.length > 0) {
      console.log('\n❌ ERRORES:');
      stats.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.file}`);
        console.log(`   ${err.error}\n`);
      });
    }

    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
main();
