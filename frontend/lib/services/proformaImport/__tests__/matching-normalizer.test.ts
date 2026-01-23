import { MatchingKeyNormalizer } from '../matching-normalizer';

describe('MatchingKeyNormalizer.normalizeProductType', () => {
  describe('90° Long Radius Elbows', () => {
    it.each([
      ['90D LR', 'ELBOW_90_LR'],
      ['90 LR', 'ELBOW_90_LR'],
      ['90LR', 'ELBOW_90_LR'],
      ['CODO RADIO LARGO 90', 'ELBOW_90_LR'],
      ['CODOS 90° RADIO LARGO', 'ELBOW_90_LR'],
      ['CODO R.L. 90', 'ELBOW_90_LR'],
    ])('normalizes "%s" to %s', (input, expected) => {
      expect(MatchingKeyNormalizer.normalizeProductType(input)).toBe(expected);
    });
  });

  describe('90° Short Radius Elbows', () => {
    it.each([
      ['90D SR', 'ELBOW_90_SR'],
      ['90 SR', 'ELBOW_90_SR'],
      ['CODO RADIO CORTO 90', 'ELBOW_90_SR'],
      ['CODOS 90', 'ELBOW_90_SR'],
    ])('normalizes "%s" to %s', (input, expected) => {
      expect(MatchingKeyNormalizer.normalizeProductType(input)).toBe(expected);
    });

    it('does not classify 90 LR as short radius', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('90 LR')).not.toBe('ELBOW_90_SR');
    });

    it('does not classify "CODO RADIO LARGO" as short radius', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('CODO RADIO LARGO 90')).toBe('ELBOW_90_LR');
    });
  });

  describe('45° Elbows', () => {
    it.each([
      ['45D LR', 'ELBOW_45'],
      ['45 LR', 'ELBOW_45'],
      ['45D ELBOW', 'ELBOW_45'],
      ['CODO 45', 'ELBOW_45'],
      ['CODOS 45', 'ELBOW_45'],
      ['CODO RADIO LARGO 45', 'ELBOW_45'],
      ['CODO RADIO LARGO A 45', 'ELBOW_45'],
    ])('normalizes "%s" to %s', (input, expected) => {
      expect(MatchingKeyNormalizer.normalizeProductType(input)).toBe(expected);
    });
  });

  describe('180° Elbows', () => {
    it.each([
      ['180', 'ELBOW_180'],
      ['CODO 180', 'ELBOW_180'],
      ['CR. LARGO Y CORTO 180', 'ELBOW_180'],
      ['RETURN', 'ELBOW_180'],
    ])('normalizes "%s" to %s', (input, expected) => {
      expect(MatchingKeyNormalizer.normalizeProductType(input)).toBe(expected);
    });
  });

  describe('Tees', () => {
    it('normalizes "TEE" to TEE', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('TEE')).toBe('TEE');
    });

    it('normalizes "TE" to TEE', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('TE')).toBe('TEE');
    });

    it('normalizes "T" to TEE', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('T')).toBe('TEE');
    });

    it('classifies TEE as REDUCER_TEE when description mentions reduccion', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('TEE', 'Con reduccion 6x4')).toBe(
        'REDUCER_TEE'
      );
    });

    it('classifies TEE as REDUCER_TEE when description mentions reducer', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('TE', 'Reducer type')).toBe('REDUCER_TEE');
    });
  });

  describe('Caps', () => {
    it.each([
      ['CAP', 'CAP'],
      ['CAS', 'CAP'],
      ['CASQUETE', 'CAP'],
      ['SEMIELIPTICO', 'CAP'],
    ])('normalizes "%s" to CAP', (input) => {
      expect(MatchingKeyNormalizer.normalizeProductType(input)).toBe('CAP');
    });
  });

  describe('Reducers', () => {
    it('normalizes "RED." to REDUCER', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('RED.')).toBe('REDUCER');
    });

    it('normalizes "REDUCER" to REDUCER', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('REDUCER')).toBe('REDUCER');
    });

    it('normalizes "REDUCCION" to REDUCER', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('REDUCCION')).toBe('REDUCER');
    });

    it('classifies "CON. RED" as REDUCER_CONCENTRIC', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('CON. RED')).toBe('REDUCER_CONCENTRIC');
    });

    it('classifies "EXC. RED" as REDUCER_ECCENTRIC', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('EXC. RED')).toBe('REDUCER_ECCENTRIC');
    });

    it('classifies "RED. TEE" as REDUCER_TEE', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('RED. TEE')).toBe('REDUCER_TEE');
    });

    it('classifies "TE RED" as REDUCER_TEE', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('TE RED')).toBe('REDUCER_TEE');
    });
  });

  describe('Crosses', () => {
    it('normalizes "CRUZ" to CROSS', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('CRUZ')).toBe('CROSS');
    });

    it('normalizes "CROSS" to CROSS', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('CROSS')).toBe('CROSS');
    });
  });

  describe('Nipples', () => {
    it('normalizes "NIPPLE" to NIPPLE', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('NIPPLE')).toBe('NIPPLE');
    });

    it('classifies "NIPPLE NPT" as NIPPLE_NPT', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('NIPPLE NPT')).toBe('NIPPLE_NPT');
    });

    it('classifies "NIPPLE BSPT" as NIPPLE_BSPT', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('NIPPLE BSPT')).toBe('NIPPLE_BSPT');
    });
  });

  describe('Flanges', () => {
    it('normalizes "W.N.R.F." to W.N.R.F.', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('W.N.R.F.')).toBe('W.N.R.F.');
    });

    it('normalizes "WELD NECK" to W.N.R.F.', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('WELD NECK')).toBe('W.N.R.F.');
    });

    it('normalizes "WNRF" to W.N.R.F.', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('WNRF')).toBe('W.N.R.F.');
    });

    it('normalizes "SORF" to SORF', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('SORF')).toBe('SORF');
    });

    it('does NOT normalize SORF to W.N.R.F.', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('SORF')).not.toBe('W.N.R.F.');
    });

    it('normalizes "BLIND" to BLIND', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('BLIND')).toBe('BLIND');
    });

    it('normalizes "THREADED" to THREADED', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('THREADED')).toBe('THREADED');
    });

    it('normalizes "ROSCAD" variations to THREADED', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('ROSCADA')).toBe('THREADED');
    });
  });

  describe('Edge cases', () => {
    it('strips trailing .0 from series numbers', () => {
      // "2000.0" -> "2000" before matching
      const result = MatchingKeyNormalizer.normalizeProductType('2000.0');
      expect(result).toBe('2000');
    });

    it('handles extra whitespace', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('  SORF  ')).toBe('SORF');
    });

    it('is case-insensitive', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('sorf')).toBe('SORF');
      expect(MatchingKeyNormalizer.normalizeProductType('Codo Radio Largo 90')).toBe('ELBOW_90_LR');
    });

    it('returns uppercased input for unknown types', () => {
      expect(MatchingKeyNormalizer.normalizeProductType('custom fitting')).toBe('CUSTOM FITTING');
    });
  });
});

describe('MatchingKeyNormalizer.normalizeSize', () => {
  it('strips quotes', () => {
    expect(MatchingKeyNormalizer.normalizeSize('"1/2"')).toBe('1/2');
    expect(MatchingKeyNormalizer.normalizeSize("'3/4'")).toBe('3/4');
  });

  it('removes .0 suffix from integers', () => {
    expect(MatchingKeyNormalizer.normalizeSize('1.0')).toBe('1');
    expect(MatchingKeyNormalizer.normalizeSize('12.0')).toBe('12');
  });

  it('preserves actual decimal values', () => {
    expect(MatchingKeyNormalizer.normalizeSize('1.5')).toBe('1.5');
  });

  it('normalizes dot-separated fractions to space-separated', () => {
    expect(MatchingKeyNormalizer.normalizeSize('2.1/2')).toBe('2 1/2');
  });

  it('normalizes concatenated fractions', () => {
    // "11/2" should become "1 1/2"
    expect(MatchingKeyNormalizer.normalizeSize('11/2')).toBe('1 1/2');
  });

  it('preserves already-formatted fractions', () => {
    expect(MatchingKeyNormalizer.normalizeSize('1 1/2')).toBe('1 1/2');
    expect(MatchingKeyNormalizer.normalizeSize('3/4')).toBe('3/4');
  });

  it('trims whitespace', () => {
    expect(MatchingKeyNormalizer.normalizeSize('  10  ')).toBe('10');
  });

  it('standardizes multiple spaces', () => {
    expect(MatchingKeyNormalizer.normalizeSize('2   1/2')).toBe('2 1/2');
  });

  it('normalizes dual size format with x', () => {
    expect(MatchingKeyNormalizer.normalizeSize('6x3')).toBe('6 X 3');
    expect(MatchingKeyNormalizer.normalizeSize('6 x 3')).toBe('6 X 3');
    expect(MatchingKeyNormalizer.normalizeSize('6 X 3')).toBe('6 X 3');
  });

  it('normalizes dual size format with *', () => {
    expect(MatchingKeyNormalizer.normalizeSize('6*3')).toBe('6 X 3');
    expect(MatchingKeyNormalizer.normalizeSize('6 * 3')).toBe('6 X 3');
  });

  it('normalizes dual size format with ×', () => {
    expect(MatchingKeyNormalizer.normalizeSize('6×3')).toBe('6 X 3');
  });
});

describe('MatchingKeyNormalizer.normalizeThickness', () => {
  it('normalizes "STANDARD" to STD', () => {
    expect(MatchingKeyNormalizer.normalizeThickness('STANDARD')).toBe('STD');
  });

  it('normalizes "STD" to STD', () => {
    expect(MatchingKeyNormalizer.normalizeThickness('STD')).toBe('STD');
  });

  it('normalizes "std" to STD (case-insensitive)', () => {
    expect(MatchingKeyNormalizer.normalizeThickness('std')).toBe('STD');
  });

  it('normalizes "XS" to XS', () => {
    expect(MatchingKeyNormalizer.normalizeThickness('XS')).toBe('XS');
  });

  it('normalizes "EXTRA PESADO" to XS', () => {
    expect(MatchingKeyNormalizer.normalizeThickness('EXTRA PESADO')).toBe('XS');
  });

  it('normalizes "EX PESADO" to XS', () => {
    expect(MatchingKeyNormalizer.normalizeThickness('EX PESADO')).toBe('XS');
  });

  it('normalizes "E.P." to XS', () => {
    expect(MatchingKeyNormalizer.normalizeThickness('E.P.')).toBe('XS');
  });

  it('returns uppercase for unknown thickness', () => {
    expect(MatchingKeyNormalizer.normalizeThickness('sch 40')).toBe('SCH 40');
  });

  it('trims whitespace', () => {
    expect(MatchingKeyNormalizer.normalizeThickness('  STD  ')).toBe('STD');
  });
});

describe('MatchingKeyNormalizer.createMatchingKey', () => {
  it('creates pipe-separated key from components', () => {
    const key = MatchingKeyNormalizer.createMatchingKey({
      type: 'SORF',
      thickness: 'STD',
      size: '1/2',
      series: 150,
    });
    expect(key).toBe('SORF|150|STD|1/2');
  });

  it('normalizes each component', () => {
    const key = MatchingKeyNormalizer.createMatchingKey({
      type: '90 LR',
      thickness: 'STANDARD',
      size: '2.1/2',
      series: 300,
    });
    expect(key).toBe('ELBOW_90_LR|300|STD|2 1/2');
  });

  it('returns null when type is empty', () => {
    const key = MatchingKeyNormalizer.createMatchingKey({
      type: '',
      thickness: 'STD',
      size: '1/2',
    });
    expect(key).toBeNull();
  });

  it('returns null when size is empty', () => {
    const key = MatchingKeyNormalizer.createMatchingKey({
      type: 'SORF',
      thickness: 'STD',
      size: '',
    });
    expect(key).toBeNull();
  });

  it('uses empty string for missing series', () => {
    const key = MatchingKeyNormalizer.createMatchingKey({
      type: 'SORF',
      thickness: 'STD',
      size: '1/2',
    });
    expect(key).toBe('SORF||STD|1/2');
  });

  it('passes description to normalizeProductType for tee classification', () => {
    const key = MatchingKeyNormalizer.createMatchingKey({
      type: 'TEE',
      thickness: 'STD',
      size: '6 X 4',
      description: 'Con reduccion',
    });
    expect(key).toBe('REDUCER_TEE||STD|6 X 4');
  });
});

describe('MatchingKeyNormalizer.extractTypeFromDescription', () => {
  it('extracts "SORF" from "SORF S-150"', () => {
    expect(MatchingKeyNormalizer.extractTypeFromDescription('SORF S-150')).toBe('SORF');
  });

  it('extracts "W.N.R.F." from "W.N.R.F. S-150 SCH STD"', () => {
    expect(MatchingKeyNormalizer.extractTypeFromDescription('W.N.R.F. S-150 SCH STD')).toBe(
      'W.N.R.F.'
    );
  });

  it('extracts "THREADED" from "THREADED S-150"', () => {
    expect(MatchingKeyNormalizer.extractTypeFromDescription('THREADED S-150')).toBe('THREADED');
  });

  it('removes schedule info', () => {
    const result = MatchingKeyNormalizer.extractTypeFromDescription('ELBOW SCH 40 2"');
    expect(result).not.toContain('SCH');
  });

  it('truncates long descriptions to first 3 words', () => {
    const long = 'VERY LONG TYPE DESCRIPTION THAT EXCEEDS THIRTY CHARACTERS LIMIT';
    const result = MatchingKeyNormalizer.extractTypeFromDescription(long);
    expect(result.split(/\s+/).length).toBeLessThanOrEqual(3);
  });

  it('handles simple types without extra info', () => {
    expect(MatchingKeyNormalizer.extractTypeFromDescription('CAP')).toBe('CAP');
  });
});

describe('MatchingKeyNormalizer.extractSeriesFromDescription', () => {
  it('extracts 150 from "SORF S-150"', () => {
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('SORF S-150')).toBe(150);
  });

  it('extracts 300 from "ELBOW S-300"', () => {
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('ELBOW S-300')).toBe(300);
  });

  it('extracts 600 from "TEE S.600"', () => {
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('TEE S.600')).toBe(600);
  });

  it('extracts 900 from "CAP S-900"', () => {
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('CAP S-900')).toBe(900);
  });

  it('extracts 1500 from "REDUCER S-1500"', () => {
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('REDUCER S-1500')).toBe(1500);
  });

  it('extracts 2500 from "BLIND S-2500"', () => {
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('BLIND S-2500')).toBe(2500);
  });

  it('returns null when no valid series found', () => {
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('SORF 1/2"')).toBeNull();
  });

  it('returns null for non-standard series numbers', () => {
    // S-200 is not a valid series
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('SORF S-200')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('sorf s-150')).toBe(150);
  });

  it('handles description without any series info', () => {
    expect(MatchingKeyNormalizer.extractSeriesFromDescription('Simple description')).toBeNull();
  });
});
