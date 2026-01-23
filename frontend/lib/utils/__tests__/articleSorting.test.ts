import {
  parseToDecimal,
  compareArticles,
  sortArticles,
  type SortableArticle,
} from '../articleSorting';

describe('parseToDecimal', () => {
  it('returns Infinity for null/undefined', () => {
    expect(parseToDecimal(null)).toBe(Infinity);
    expect(parseToDecimal(undefined)).toBe(Infinity);
    expect(parseToDecimal('')).toBe(Infinity);
  });

  it('parses simple fractions', () => {
    expect(parseToDecimal('1/2')).toBe(0.5);
    expect(parseToDecimal('3/4')).toBe(0.75);
    expect(parseToDecimal('1/4')).toBe(0.25);
    expect(parseToDecimal('7/8')).toBe(0.875);
  });

  it('parses integers', () => {
    expect(parseToDecimal('1')).toBe(1);
    expect(parseToDecimal('10')).toBe(10);
    expect(parseToDecimal('24')).toBe(24);
  });

  it('parses decimals', () => {
    expect(parseToDecimal('0.5')).toBe(0.5);
    expect(parseToDecimal('1.5')).toBe(1.5);
    expect(parseToDecimal('12.75')).toBe(12.75);
  });

  it('parses mixed fractions', () => {
    expect(parseToDecimal('1 1/2')).toBe(1.5);
    expect(parseToDecimal('2 3/4')).toBe(2.75);
    expect(parseToDecimal('3 1/4')).toBe(3.25);
  });

  it('strips quotes', () => {
    expect(parseToDecimal('"1/2"')).toBe(0.5);
    expect(parseToDecimal("'3/4'")).toBe(0.75);
  });

  it('trims whitespace', () => {
    expect(parseToDecimal('  1/2  ')).toBe(0.5);
    expect(parseToDecimal(' 10 ')).toBe(10);
  });
});

describe('compareArticles', () => {
  it('sorts by type alphabetically first', () => {
    const a: SortableArticle = { type: 'SORF', series: 150 };
    const b: SortableArticle = { type: 'Ciega', series: 150 };
    expect(compareArticles(a, b)).toBeGreaterThan(0); // SORF after Ciega
  });

  it('puts items without type at the end', () => {
    const withType: SortableArticle = { type: 'Ciega', series: 150 };
    const noType: SortableArticle = { type: null, series: 150 };
    expect(compareArticles(noType, withType)).toBeGreaterThan(0);
    expect(compareArticles(withType, noType)).toBeLessThan(0);
  });

  it('sorts by series when type is equal', () => {
    const a: SortableArticle = { type: 'Ciega', series: 300 };
    const b: SortableArticle = { type: 'Ciega', series: 150 };
    expect(compareArticles(a, b)).toBeGreaterThan(0);
  });

  it('sorts by thickness when type and series are equal', () => {
    const a: SortableArticle = { type: 'Ciega', series: 150, thickness: '3/4' };
    const b: SortableArticle = { type: 'Ciega', series: 150, thickness: '1/2' };
    expect(compareArticles(a, b)).toBeGreaterThan(0); // 0.75 > 0.5
  });

  it('sorts by size as last resort', () => {
    const a: SortableArticle = { type: 'Ciega', series: 150, thickness: '1/2', size: '10' };
    const b: SortableArticle = { type: 'Ciega', series: 150, thickness: '1/2', size: '1' };
    expect(compareArticles(a, b)).toBeGreaterThan(0); // 10 > 1
  });

  it('returns 0 for identical articles', () => {
    const article: SortableArticle = { type: 'Ciega', series: 150, thickness: '1/2', size: '1' };
    expect(compareArticles(article, article)).toBe(0);
  });
});

describe('sortArticles', () => {
  it('does not mutate the original array', () => {
    const original: SortableArticle[] = [
      { type: 'SORF', series: 150 },
      { type: 'Ciega', series: 150 },
    ];
    const originalCopy = [...original];
    sortArticles(original);
    expect(original).toEqual(originalCopy);
  });

  it('sorts a complex set of articles correctly', () => {
    const articles: SortableArticle[] = [
      { type: 'SORF', series: 300, thickness: '1', size: '2' },
      { type: 'Ciega', series: 150, thickness: '1/2', size: '1' },
      { type: 'Ciega', series: 300, thickness: '1/2', size: '1' },
      { type: 'Ciega', series: 150, thickness: '3/4', size: '1' },
      { type: null, series: 150, thickness: '1/2', size: '1' },
      { type: 'Roscada', series: 150, thickness: '1/2', size: '1' },
    ];

    const sorted = sortArticles(articles);

    // Expected order:
    // 1. Ciega S-150 1/2" (type=Ciega, series=150, thickness smallest)
    // 2. Ciega S-150 3/4"
    // 3. Ciega S-300 1/2"
    // 4. Roscada S-150 1/2"
    // 5. SORF S-300 1"
    // 6. null S-150 1/2" (no type = last)

    expect(sorted[0].type).toBe('Ciega');
    expect(sorted[0].series).toBe(150);
    expect(sorted[0].thickness).toBe('1/2');

    expect(sorted[1].type).toBe('Ciega');
    expect(sorted[1].thickness).toBe('3/4');

    expect(sorted[2].type).toBe('Ciega');
    expect(sorted[2].series).toBe(300);

    expect(sorted[3].type).toBe('Roscada');
    expect(sorted[4].type).toBe('SORF');
    expect(sorted[5].type).toBeNull(); // No type = last
  });

  it('handles empty array', () => {
    expect(sortArticles([])).toEqual([]);
  });

  it('handles single item', () => {
    const items: SortableArticle[] = [{ type: 'Ciega', series: 150 }];
    expect(sortArticles(items)).toEqual(items);
  });
});
