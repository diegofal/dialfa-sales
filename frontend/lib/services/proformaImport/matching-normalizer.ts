/**
 * Matching key normalizer
 * Ported from dialfa-comparer/price_calculator.py
 */

export class MatchingKeyNormalizer {
  /**
   * Normalize product type to canonical form
   */
  static normalizeProductType(type: string, description: string = ''): string {
    let normalized = type.toUpperCase().trim();
    const desc = description.toUpperCase();

    // Remove extra spaces and standardize
    normalized = normalized.replace(/\s+/g, ' ').trim();
    // Remove trailing .0 from series numbers (e.g., "2000.0" -> "2000")
    normalized = normalized.replace(/\.0+$/, '');

    // 90° Long Radius Elbows
    if (
      /90D?\s*LR|90\s*LR|CODO\s*RADIO\s*LARGO\s*90|CODOS?\s*90°?\s*RADIO\s*LARGO|CODO\s*R\.L\.\s*90/i.test(
        normalized
      )
    ) {
      return 'ELBOW_90_LR';
    }

    // 90° Short Radius Elbows
    if (
      /90D?\s*SR|90\s*SR|CODO\s*RADIO\s*CORTO\s*90|CODOS?\s*90°?/i.test(normalized) &&
      !/LARGO|LR|LONG/i.test(normalized)
    ) {
      return 'ELBOW_90_SR';
    }

    // 45° Elbows
    if (
      /45D?\s*LR|45\s*LR|45D?\s*ELBOW|CODO\s*45|CODOS?\s*45|CODO\s*RADIO\s*LARGO\s*45|CODO\s*RADIO\s*LARGO\s*A\s*45/i.test(
        normalized
      )
    ) {
      return 'ELBOW_45';
    }

    // 180° Elbows / Returns
    if (/180|CODO\s*180|CR\.\s*LARGO\s*Y\s*CORTO\s*180|RETURN/i.test(normalized)) {
      return 'ELBOW_180';
    }

    // Tees - need to distinguish between normal tees and reducing tees
    if (/^(TEE?|TE|T)$/i.test(normalized)) {
      // Check description to see if it's a reducing tee
      if (/RED|REDUCCION|REDUCER/i.test(desc)) {
        return 'REDUCER_TEE';
      }
      return 'TEE';
    }

    // Caps / Casquetes
    if (/CAP|CAS|CASQUETE|SEMIELIPTICO/i.test(normalized)) {
      return 'CAP';
    }

    // Reducers
    if (/RED\.|REDUCER|REDUCCION|CON\.\s*RED|EXC\.\s*RED|RED\.\s*TEE|TE\s*RED/i.test(normalized)) {
      if (/TEE|TE\s*RED/i.test(normalized)) {
        return 'REDUCER_TEE';
      }
      if (/CON|CONCENTRIC|CONCENTRICA/i.test(normalized)) {
        return 'REDUCER_CONCENTRIC';
      }
      if (/EXC|ECCENTRIC|EXCENTRICA/i.test(normalized)) {
        return 'REDUCER_ECCENTRIC';
      }
      return 'REDUCER';
    }

    // Crosses
    if (/CRUZ|CROSS/i.test(normalized)) {
      return 'CROSS';
    }

    // Nipples
    if (/NIPPLE/i.test(normalized)) {
      if (/NPT/i.test(normalized)) {
        return 'NIPPLE_NPT';
      }
      if (/BSPT/i.test(normalized)) {
        return 'NIPPLE_BSPT';
      }
      return 'NIPPLE';
    }

    // Flanges - Keep specific types distinct
    // DO NOT normalize SORF and W.N.R.F. to the same value
    if (/W\.N\.R\.F|WELD\s*NECK|WNRF/i.test(normalized)) {
      return 'W.N.R.F.';
    }

    if (/SORF/i.test(normalized)) {
      return 'SORF';
    }

    // Blind flanges
    if (/BLIND/i.test(normalized)) {
      return 'BLIND';
    }

    // Threaded flanges
    if (/THREADED|ROSCAD/i.test(normalized)) {
      return 'THREADED';
    }

    return normalized;
  }

  /**
   * Normalize size string
   */
  static normalizeSize(size: string): string {
    let normalized = size.replace(/["']/g, '').trim();

    // Remove .0 suffix from float strings (e.g., "1.0" -> "1", "12.0" -> "12")
    if (/^\d+\.0$/.test(normalized)) {
      normalized = normalized.replace('.0', '');
    }

    // Normalize spaces in fractions: "1 1/2" should match "1.1/2" and "11/2"
    // First remove dots before digits that precede slashes
    normalized = normalized.replace(/\.(\d+\/)/, ' $1'); // "2.1/2" -> "2 1/2"
    // Ensure there's a space before fractions like "11/2" -> "1 1/2"
    normalized = normalized.replace(/(\d)([1-9]\/)/g, '$1 $2'); // "11/2" -> "1 1/2"
    // Standardize multiple spaces to single space
    normalized = normalized.replace(/\s+/g, ' ').trim();

    // For reducer tees/reducers: normalize the dual size format
    // Examples: "6 X 3" -> "6 X 3", "6x3" -> "6 X 3", "6*3" -> "6 X 3", "6 * 3" -> "6 X 3"
    const dualSizeMatch = normalized.match(/^(\d+(?:\s*\d+\/\d+)?)\s*[Xx\*×]\s*(\d+(?:\s*\d+\/\d+)?)/);
    if (dualSizeMatch) {
      const size1 = dualSizeMatch[1].trim();
      const size2 = dualSizeMatch[2].trim();
      normalized = `${size1} X ${size2}`;
    }

    return normalized;
  }

  /**
   * Normalize thickness/espesor
   */
  static normalizeThickness(thickness: string): string {
    const normalized = thickness.toUpperCase().trim();

    if (/STANDARD|STD/i.test(normalized)) {
      return 'STD';
    }
    if (/EXTRA\s*PESADO|XS|EX\s*PESADO|E\.P\./i.test(normalized)) {
      return 'XS';
    }

    return normalized;
  }

  /**
   * Create matching key from components
   */
  static createMatchingKey(data: {
    type: string;
    thickness: string;
    size: string;
    series?: number;
    description?: string;
  }): string | null {
    const type = this.normalizeProductType(data.type, data.description || '');
    const thickness = this.normalizeThickness(data.thickness);
    const size = this.normalizeSize(data.size);
    const series = data.series?.toString() || '';

    if (!type || !size) {
      return null;
    }

    return `${type}|${series}|${thickness}|${size}`;
  }

  /**
   * Extract type from description when type field is not available
   * Returns the cleaned description as type, with minimal normalization
   */
  static extractTypeFromDescription(description: string): string {
    const desc = description.toUpperCase().trim();
    
    // Extract just the type part (before size/schedule info)
    // For "SORF S-150" -> "SORF"
    // For "W.N.R.F. S-150 SCH STD" -> "W.N.R.F."
    // For "THREADED S-150" -> "THREADED"
    
    // Remove series info (S-150, S-300, S-600)
    let type = desc
      .replace(/\s+S[-.]?\d+/i, '')
      .replace(/\s+SCH\s+(STD|XS|\d+).*$/i, '')
      .replace(/\s+S\.\d+.*$/i, '')
      .replace(/\s+\d+["'].*$/i, '')
      .trim();
    
    // If it's too long, try to extract just the main type
    if (type.length > 30) {
      // Get first few words
      const words = type.split(/\s+/);
      type = words.slice(0, 3).join(' ');
    }
    
    return type;
  }

  /**
   * Extract series number from description
   * Returns series number (150, 300, 600) or null
   */
  static extractSeriesFromDescription(description: string): number | null {
    const desc = description.toUpperCase().trim();
    
    // Match S-150, S-300, S-600, S.150, etc.
    // Valid series are typically 150, 300, 600, 900, 1500, 2500
    const validSeries = [150, 300, 600, 900, 1500, 2500];
    
    // Look for all S-XXX patterns
    const seriesMatches = desc.matchAll(/S[-.]?(\d+)/gi);
    
    for (const match of seriesMatches) {
      const series = parseInt(match[1], 10);
      if (validSeries.includes(series)) {
        return series;
      }
    }
    
    return null;
  }
}

