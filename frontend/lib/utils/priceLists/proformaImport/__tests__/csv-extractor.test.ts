import { CsvExtractor } from '../csv-extractor';

describe('CsvExtractor', () => {
  const extractor = new CsvExtractor();

  function bufferFrom(content: string): Buffer {
    return Buffer.from(content, 'utf-8');
  }

  describe('extract', () => {
    it('parses valid CSV with all columns', async () => {
      const csv = [
        'description,size,quantity,unit_price,total_price,unit_weight,item_number',
        'ELBOW 90 S3000 SW,1/2",1500,0.83,1245,0.2,7',
        'TEE S2000 BSPT,3/4",500,1.33,665,0.39,20',
      ].join('\n');

      const result = await extractor.extract(bufferFrom(csv), 'Bestflow_PIF001_2026-04-07.csv');

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        description: 'ELBOW 90 S3000 SW',
        size: '1/2"',
        quantity: 1500,
        unitPrice: 0.83,
        totalPrice: 1245,
        unitWeight: 0.2,
        itemNumber: '7',
      });
      expect(result.items[1]).toMatchObject({
        description: 'TEE S2000 BSPT',
        size: '3/4"',
        quantity: 500,
        unitPrice: 1.33,
      });
      expect(result.summary.totalRows).toBe(2);
      expect(result.summary.extractedRows).toBe(2);
    });

    it('handles missing optional columns', async () => {
      const csv = ['description,size,quantity,unit_price', 'ELBOW 90 S3000 SW,1",200,1.25'].join(
        '\n'
      );

      const result = await extractor.extract(bufferFrom(csv), 'test.csv');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].totalPrice).toBe(250); // calculated: 200 * 1.25
      expect(result.items[0].unitWeight).toBe(0);
    });

    it('skips rows with missing required values', async () => {
      const csv = [
        'description,size,quantity,unit_price',
        'ELBOW 90 S3000,1",0,1.25', // quantity = 0 → skipped
        ',1",100,1.25', // no description → skipped
        'TEE S2000,3/4",500,0', // price = 0 → skipped
        'VALID ITEM,2",100,5.00', // valid → kept
      ].join('\n');

      const result = await extractor.extract(bufferFrom(csv), 'test.csv');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].description).toBe('VALID ITEM');
    });

    it('skips empty rows', async () => {
      const csv = [
        'description,size,quantity,unit_price',
        'ELBOW 90,1",100,1.25',
        ',,,,',
        '',
        'TEE,2",200,3.00',
      ].join('\n');

      const result = await extractor.extract(bufferFrom(csv), 'test.csv');
      expect(result.items).toHaveLength(2);
    });

    it('throws on missing required columns', async () => {
      const csv = ['description,size,quantity', 'ELBOW 90,1",100'].join('\n');

      await expect(extractor.extract(bufferFrom(csv), 'test.csv')).rejects.toThrow(/unit_price/);
    });

    it('throws on empty CSV', async () => {
      await expect(extractor.extract(bufferFrom(''), 'test.csv')).rejects.toThrow(/vacío/);
    });

    it('throws on header-only CSV', async () => {
      const csv = 'description,size,quantity,unit_price';
      const result = await extractor.extract(bufferFrom(csv), 'test.csv');
      expect(result.items).toHaveLength(0);
    });

    it('handles numbers with commas', async () => {
      const csv = [
        'description,size,quantity,unit_price,total_price',
        'LARGE ORDER,4","1,500","2,345.67","3,518,505"',
      ].join('\n');

      const result = await extractor.extract(bufferFrom(csv), 'test.csv');
      expect(result.items[0].quantity).toBe(1500);
      expect(result.items[0].unitPrice).toBe(2345.67);
    });

    it('handles quoted fields with commas', async () => {
      const csv = [
        'description,size,quantity,unit_price',
        '"ELBOW 90, LONG RADIUS",1/2",100,1.25',
      ].join('\n');

      const result = await extractor.extract(bufferFrom(csv), 'test.csv');
      expect(result.items[0].description).toBe('ELBOW 90, LONG RADIUS');
    });

    it('recognizes column aliases', async () => {
      const csv = ['desc,medida,qty,precio_unitario,peso', 'ELBOW 90,1",100,1.25,0.5'].join('\n');

      const result = await extractor.extract(bufferFrom(csv), 'test.csv');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].unitWeight).toBe(0.5);
    });

    it('handles Windows line endings (\\r\\n)', async () => {
      const csv = 'description,size,quantity,unit_price\r\nELBOW 90,1",100,1.25\r\nTEE,2",200,3.00';

      const result = await extractor.extract(bufferFrom(csv), 'test.csv');
      expect(result.items).toHaveLength(2);
    });
  });

  describe('extractMetadataFromFilename', () => {
    it('parses full convention: Supplier_ProformaNum_Date', () => {
      const meta = extractor.extractMetadataFromFilename('Bestflow_PIF25159_2026-04-07.csv');
      expect(meta.supplier).toBe('Bestflow');
      expect(meta.proformaNumber).toBe('PIF25159');
      expect(meta.date).toBe('2026-04-07');
      expect(meta.fileName).toBe('Bestflow_PIF25159_2026-04-07.csv');
    });

    it('parses two parts: Supplier_ProformaNum', () => {
      const meta = extractor.extractMetadataFromFilename('Ulma_PI-2026-001.csv');
      expect(meta.supplier).toBe('Ulma');
      expect(meta.proformaNumber).toBe('PI-2026-001');
      expect(meta.date).toBeUndefined();
    });

    it('falls back to filename as supplier when no underscore', () => {
      const meta = extractor.extractMetadataFromFilename('proforma.csv');
      expect(meta.supplier).toBe('proforma');
      expect(meta.proformaNumber).toBe('Unknown');
    });

    it('handles multiple underscores in date portion', () => {
      const meta = extractor.extractMetadataFromFilename('Bestflow_PIF001_2026_04_07.csv');
      expect(meta.supplier).toBe('Bestflow');
      expect(meta.proformaNumber).toBe('PIF001');
      expect(meta.date).toBe('2026_04_07');
    });
  });
});
