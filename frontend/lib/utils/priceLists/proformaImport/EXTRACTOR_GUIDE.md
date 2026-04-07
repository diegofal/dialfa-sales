# Proforma Import — Extractor Guide

> **Audience:** AI assistants and developers tasked with mapping new proforma Excel files to the normalized CSV format for import into SPISA.

## Architecture

```
Supplier proforma (Excel)
    ↓
AI/human maps to normalized CSV   ← THIS IS THE STEP YOU DO
    ↓
App imports CSV (CsvExtractor)
    ↓
ExtractedItem[] → ArticleMatcher → MatchedArticle[] → UI
```

The app has a single CSV parser (`csv-extractor.ts`). You never need to write new TypeScript code. You just need to **convert the Excel file into a CSV with the correct format**.

## Normalized CSV Format

### Required Columns

| Column        | Description                                                 | Example               |
| ------------- | ----------------------------------------------------------- | --------------------- |
| `description` | Product type + series + connection for matching (see below) | `ELBOW 90 S3000 SW`   |
| `size`        | Size/diameter                                               | `1/2"`, `2"`, `6 X 3` |
| `quantity`    | Quantity (numeric)                                          | `1000`                |
| `unit_price`  | Unit price in USD                                           | `0.88`                |

### Optional Columns

| Column        | Description                                             | Example |
| ------------- | ------------------------------------------------------- | ------- |
| `total_price` | Total price (calculated as qty × unit_price if missing) | `880`   |
| `unit_weight` | Weight per unit in kg                                   | `0.223` |
| `item_number` | Line item number from original                          | `1`     |

### Column Aliases

The parser recognizes these aliases (case-insensitive):

- `description` / `descripcion` / `desc`
- `size` / `medida`
- `quantity` / `qty` / `cantidad`
- `unit_price` / `unitprice` / `precio_unitario`
- `total_price` / `totalprice` / `total` / `precio_total`
- `unit_weight` / `unitweight` / `weight` / `peso` / `peso_unitario`
- `item_number` / `itemnumber` / `item` / `numero`

## Filename Convention

```
{Supplier}_{ProformaNumber}_{YYYY-MM-DD}.csv
```

Examples:

- `Bestflow_PIF25159_2026-04-07.csv`
- `Ulma_PI-2026-001_2026-03-15.csv`
- `Unknown_NA.csv` (fallback — just supplier name)

The app parses metadata from the filename using `_` as separator:

- Part 1 → supplier name
- Part 2 → proforma number
- Part 3+ → date (optional)

## How to Compose the `description` Field

This is the most critical part. The `description` field must contain enough information for the `MatchingKeyNormalizer` to extract:

1. **Product type** — what the article is
2. **Series** — pressure class (for fittings/flanges)
3. **Thickness/Connection** — how it connects or its wall thickness

### Format

```
{ProductType} {Series} {Connection/Thickness}
```

### Recognized Product Types

The normalizer (`matching-normalizer.ts`) recognizes these keywords:

| Keywords in description                     | Normalized to        | Notes                  |
| ------------------------------------------- | -------------------- | ---------------------- |
| `ELBOW 90`, `90D LR`, `CODO RADIO LARGO 90` | `ELBOW_90_LR`        | 90° long radius elbow  |
| `90D SR`, `CODO 90` (without LARGO/LR)      | `ELBOW_90_SR`        | 90° short radius elbow |
| `ELBOW 45`, `45D`, `CODO 45`                | `ELBOW_45`           | 45° elbow              |
| `180`, `RETURN`, `CODO 180`                 | `ELBOW_180`          | 180° return            |
| `TEE`, `TE`                                 | `TEE`                | Standard tee           |
| `TEE` + `RED`/`REDUCER` in desc             | `REDUCER_TEE`        | Reducing tee           |
| `CAP`, `CASQUETE`                           | `CAP`                | End cap                |
| `RED.`, `REDUCER`, `REDUCCION`              | `REDUCER`            | General reducer        |
| `CON. RED`, `CONCENTRIC`                    | `REDUCER_CONCENTRIC` | Concentric reducer     |
| `EXC. RED`, `ECCENTRIC`                     | `REDUCER_ECCENTRIC`  | Eccentric reducer      |
| `CROSS`, `CRUZ`                             | `CROSS`              | Cross fitting          |
| `NIPPLE`                                    | `NIPPLE`             | Nipple                 |
| `W.N.R.F.`, `WELD NECK`, `WNRF`             | `W.N.R.F.`           | Weld neck flange       |
| `SORF`                                      | `SORF`               | Slip-on flange         |
| `BLIND`                                     | `BLIND`              | Blind flange           |
| `THREADED`, `ROSCAD`                        | `THREADED`           | Threaded flange        |

### Series Recognition

The normalizer looks for patterns like `S-150`, `S-300`, `S.600`, `S2000`, `S3000`:

- Valid series: **150, 300, 600, 900, 1500, 2500** (for flanges)
- Also recognizes: **2000, 3000, 6000** (for forged fittings)

Use format `S{number}` or `S-{number}` in the description.

### Thickness/Connection Recognition

| Keywords                                   | Normalized to                | Used for                     |
| ------------------------------------------ | ---------------------------- | ---------------------------- |
| `SCH STD`, `SCH 40`, `S.40`                | `STD` (or `40` for W.N.R.F.) | Standard wall                |
| `SCH XS`, `SCH 80`, `S.80`, `EXTRA PESADO` | `XS` (or `80` for W.N.R.F.)  | Extra strong                 |
| `SW`                                       | (kept as-is in description)  | Socket weld fittings         |
| `BSPT`                                     | (kept as-is in description)  | British standard pipe thread |
| `NPT`                                      | (kept as-is in description)  | National pipe thread         |

**Note:** For forged fittings (elbows, tees, unions, couplings), the connection type (SW, BSPT, NPT) is NOT extracted as thickness by the matcher — it stays in the description for human reference but doesn't affect matching. The matching key for forged fittings is primarily `TYPE|SERIES||SIZE`.

## Step-by-Step: Mapping a New Excel File

1. **Open the Excel file** and identify the layout:
   - Where does data start? (skip header/logo rows)
   - Which column is which? (size, quantity, price, etc.)
   - Are product types in data rows or section headers?

2. **Identify product types:**
   - If each row has a "description" column → use it directly
   - If product types are in section headers (e.g., row says "ELBOW 90" followed by data rows) → carry the section header down to each data row

3. **Compose the `description` column:**
   - Combine: product type + series + connection
   - Example: section header "ELBOW 90°" + row has S3000 + SW → `ELBOW 90 S3000 SW`
   - Use the keywords from the table above

4. **Map remaining columns** to the normalized format (size, quantity, unit_price, etc.)

5. **Handle special items** (bolts, nuts, gaskets):
   - These may not match DB articles — that's OK
   - Still include them with descriptive descriptions
   - Example: `Stud bolt A193-B7`, `Heavy Nuts A194-2H`

6. **Name the file** using the convention: `{Supplier}_{ProformaNumber}_{Date}.csv`

7. **Import** the CSV through the app's "Importar Proforma" button

## Worked Example

### Source: "OFFER SHEET OF FITTINGS&BOLTS&NUTS.xls"

**Excel structure:**

```
Row 0: QINGDAO BESTFLOW INDUSTRIAL CO., LTD.
Row 2: OFFER SHEET
Row 3: (date as Excel serial: 46119 = 2026-04-07)
Row 4: Headers: Y | Description | (blank) | (blank) | Quantity | Unit Weight | Unit Price | Total
Row 7: Section header: "ELBOW 90°"
Row 8: 1 | 1/2" | S2000 | BSPT | 1000 | 0.223 | 0.88 | 880
...
Row 23: Section header: "ELBOW 45°"
Row 27: Section header: "TEE"
Row 38: Section header: "UNION"
Row 46: Section header: "COUPLING"
Row 51: Section header: "CAP"
Row 53: Section header: "HEX HEAD PLUG"
Row 58: Section header: "HEX HEAD BUSHING"
Row 61: Section header: "HEX THD NIPPLE"
Row 67: Section header: "Stud bolt, A193-B7 Blackened"
Row 89: Section header: "Heavy Nuts, A194-2H Blackened"
```

**Mapping logic:**

- Col 0 = item_number, Col 1 = size, Col 2 = series, Col 3 = connection
- Col 4 = quantity, Col 5 = unit_weight, Col 6 = unit_price, Col 7 = total_price
- description = "{section header} {series} {connection}"
- For bolts/nuts: no series/connection columns → description = section header only

**Resulting CSV:** `Bestflow_OFFER-FITTINGS_2026-04-07.csv`

```csv
description,size,quantity,unit_price,total_price,unit_weight,item_number
ELBOW 90 S2000 BSPT,1/2",1000,0.88,880,0.223,1
ELBOW 90 S2000 BSPT,3/4",1000,1.08,1080,0.29,2
ELBOW 90 S3000 SW,1/2",1500,0.83,1245,0.2,7
ELBOW 90 S3000 SW,3/4",1500,1,1500,0.285,8
ELBOW 45 S3000 SW,1",100,1.25,125,0.41,16
TEE S2000 BSPT,1/2",500,1,500,0.261,19
UNION S3000 BSPT,1/2",200,1.17,234,0.28,29
COUPLING S3000 NPT,1/2",2000,0.43,860,0.13,36
CAP NPT,3/4",200,0.67,134,0.19,40
HEX HEAD PLUG BSPT,1/2",800,0.5,400,0.06,41
HEX HEAD BUSHING BSPT,1X3/4",300,0.7,210,0.08,45
HEX THD NIPPLE BSPT,1/2",300,0.5,150,0.07,47
Stud bolt A193-B7,1/2"X2-3/4",3000,0.09,270,0.069,52
Heavy Nuts A194-2H,1/2",50000,0.05,2500,0.03,73
```

## Testing Your CSV

After importing:

1. Check the **import preview** shows the correct number of items
2. Verify **matched items** have the right article codes (compare with DB)
3. Check **unmatched items** — review `debugInfo` to see what type/series/size was extracted
4. If matching is poor, adjust the `description` field format and re-import

## Key Files Reference

- `csv-extractor.ts` — CSV parser (you don't modify this)
- `article-matcher.ts` — Matching logic using TYPE|SERIES|THICKNESS|SIZE keys
- `matching-normalizer.ts` — Type/size/thickness normalization rules
- `types.ts` — ExtractedItem, ExtractedProforma type definitions
- `bestflow-extractor.ts` — Legacy Excel extractor (for original Bestflow format only)
