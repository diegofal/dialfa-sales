/**
 * ============================================================================
 * ORDENAMIENTO GLOBAL DE ARTÍCULOS
 * ============================================================================
 *
 * Este módulo contiene las funciones de ordenamiento estándar para artículos.
 *
 * ORDEN DE PRIORIDAD:
 * 1. type       → Alfabéticamente (Ciega → Roscada → SORF). Sin type va al final.
 * 2. series     → Numéricamente (150 → 300 → 600)
 * 3. thickness  → Numéricamente con parsing de fracciones (1/2 → 3/4 → 1)
 * 4. size       → Numéricamente con parsing de fracciones (1/2 → 3/4 → 1 → 10)
 *
 * NOTAS:
 * - Los artículos sin `type` van al final del listado
 * - Soporta fracciones: "1/2", "3/4", "1 1/2" (fracciones mixtas)
 * - Soporta decimales: "0.5", "1.5"
 * - Soporta enteros: "1", "10", "24"
 *
 * USO:
 * import { sortArticles, parseToDecimal } from '@/lib/utils/articleSorting';
 *
 * const sortedItems = sortArticles(items);
 *
 * ============================================================================
 */

/**
 * Interface mínima requerida para ordenar artículos
 */
export interface SortableArticle {
  type?: string | null;
  series?: number | null;
  thickness?: string | null;
  size?: string | null;
}

/**
 * Parsea valores de medida (fracciones, decimales, enteros) a número decimal.
 *
 * Ejemplos:
 * - "1/2"    → 0.5
 * - "3/4"    → 0.75
 * - "1 1/2"  → 1.5
 * - "10"     → 10
 * - "0.5"    → 0.5
 * - undefined/null → Infinity (va al final)
 *
 * @param value - String con el valor a parsear
 * @returns Número decimal para comparación
 */
export function parseToDecimal(value?: string | null): number {
  if (!value) return Infinity; // Items sin valor van al final

  // Remover comillas y espacios
  const cleaned = value.replace(/['"]/g, '').trim();

  // Intentar parsear como fracción (1/2, 3/4, etc.)
  const fractionMatch = cleaned.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1]);
    const denominator = parseInt(fractionMatch[2]);
    return numerator / denominator;
  }

  // Intentar parsear como decimal o entero (0.5, 1.5, 10, etc.)
  const decimalMatch = cleaned.match(/^(\d+\.?\d*)$/);
  if (decimalMatch) {
    return parseFloat(decimalMatch[1]);
  }

  // Si contiene fracciones mixtas como "1 1/2"
  const mixedMatch = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseInt(mixedMatch[2]);
    const denominator = parseInt(mixedMatch[3]);
    return whole + numerator / denominator;
  }

  // Si es texto puro, usar código ASCII para ordenar alfabéticamente
  return cleaned.charCodeAt(0) * 1000;
}

/**
 * Compara dos artículos para ordenamiento.
 *
 * Orden de prioridad:
 * 1. type (alfabético, sin type al final)
 * 2. series (numérico)
 * 3. thickness (numérico/fraccional)
 * 4. size (numérico/fraccional)
 *
 * @param a - Primer artículo
 * @param b - Segundo artículo
 * @returns Número negativo si a < b, positivo si a > b, 0 si iguales
 */
export function compareArticles<T extends SortableArticle>(a: T, b: T): number {
  // 1. Ordenar por type (alfabéticamente, sin type va al final)
  const typeA = a.type?.toLowerCase() || '';
  const typeB = b.type?.toLowerCase() || '';

  // Items sin type van al final
  if (!typeA && typeB) return 1;
  if (typeA && !typeB) return -1;

  if (typeA !== typeB) {
    return typeA.localeCompare(typeB);
  }

  // 2. Ordenar por series (numérico)
  const seriesA = a.series || 0;
  const seriesB = b.series || 0;
  if (seriesA !== seriesB) {
    return seriesA - seriesB;
  }

  // 3. Ordenar por thickness (fraccionario/numérico)
  const thicknessA = parseToDecimal(a.thickness);
  const thicknessB = parseToDecimal(b.thickness);
  if (thicknessA !== thicknessB) {
    return thicknessA - thicknessB;
  }

  // 4. Ordenar por size (fraccionario/numérico)
  const sizeA = parseToDecimal(a.size);
  const sizeB = parseToDecimal(b.size);
  return sizeA - sizeB;
}

/**
 * Ordena un array de artículos según el orden estándar.
 *
 * @param articles - Array de artículos a ordenar
 * @returns Nuevo array ordenado (no modifica el original)
 *
 * @example
 * const items = [
 *   { type: 'SORF', series: 150, size: '1"' },
 *   { type: 'Ciega', series: 150, size: '1/2"' },
 *   { type: 'Ciega', series: 300, size: '1/2"' },
 * ];
 *
 * const sorted = sortArticles(items);
 * // Resultado:
 * // 1. Ciega S-150 de 1/2"
 * // 2. Ciega S-300 de 1/2"
 * // 3. SORF S-150 de 1"
 */
export function sortArticles<T extends SortableArticle>(articles: T[]): T[] {
  return [...articles].sort(compareArticles);
}

/**
 * Ordena artículos dentro de categorías.
 * Útil para datos agrupados por categoría.
 *
 * @param categories - Array de categorías con items
 * @returns Nuevo array con items ordenados dentro de cada categoría
 *
 * @example
 * const data = [
 *   { categoryName: 'Bridas', items: [...] },
 *   { categoryName: 'Accesorios', items: [...] },
 * ];
 *
 * const sorted = sortArticlesByCategory(data);
 */
export function sortArticlesByCategory<T extends SortableArticle, C extends { items: T[] }>(
  categories: C[]
): C[] {
  return categories.map((category) => ({
    ...category,
    items: sortArticles(category.items),
  }));
}
