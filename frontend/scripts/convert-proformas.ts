import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const dir = 'D:/Pedidos/Proformas';
const outDir = path.join(dir, 'csvs');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = fs
  .readdirSync(dir)
  .filter(
    (f) =>
      (f.endsWith('.xls') || f.endsWith('.xlsx')) &&
      !f.startsWith('Vacio') &&
      !f.includes('(copia)')
  );

console.log(`Processing ${files.length} Excel files...\n`);

let totalOk = 0;
let totalSkip = 0;

for (const file of files) {
  try {
    const filePath = path.join(dir, file);
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];

    if (!ws['!ref']) {
      console.log('SKIP (empty):', file);
      totalSkip++;
      continue;
    }

    const range = XLSX.utils.decode_range(ws['!ref']);
    if (range.e.c < 3) {
      console.log('SKIP (index file):', file);
      totalSkip++;
      continue;
    }

    const parts = file.replace(/\.(xlsx?)$/, '').split(' - ');
    const date = parts[0] || '';
    const proformaNum = parts[1] || '';
    const supplier = parts[2] || '';

    const getCell = (r: number, c: number) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell ? cell.v : null;
    };
    const getCellStr = (r: number, c: number) => {
      const v = getCell(r, c);
      return v !== null && v !== undefined ? String(v).trim() : '';
    };

    // Find header row and map columns by name
    let headerRow = -1;
    let dataStartRow = -1;
    let isOldFormat = false; // "Description & Size" format

    const colIdx = {
      itemNum: 0,
      desc: -1,
      size: -1,
      thickness: -1,
      qty: -1,
      unitWeight: -1,
      unitPrice: -1,
      total: -1,
    };

    for (let r = 0; r <= Math.min(15, range.e.r); r++) {
      const cells: string[] = [];
      for (let c = 0; c <= range.e.c; c++) {
        cells[c] = getCellStr(r, c).toUpperCase();
      }
      const rowStr = cells.join('|');

      if (rowStr.includes('DESCRIPTION & SIZE')) {
        isOldFormat = true;
        headerRow = r;
        // Old format: col1=Desc&Size, col2=Qty, col3=Price, col4=Total, col5=UnitWeight
        colIdx.desc = 1;
        colIdx.qty = 2;
        colIdx.unitPrice = 3;
        colIdx.total = 4;
        colIdx.unitWeight = 5;
        dataStartRow = r + 2;
        break;
      }

      if (
        rowStr.includes('DESCRIPTION') &&
        (rowStr.includes('QUANTITY') || rowStr.includes('QTY'))
      ) {
        headerRow = r;
        for (let c = 0; c <= range.e.c; c++) {
          const h = cells[c];
          if (h.includes('DESCRIPTION')) colIdx.desc = c;
          else if (h.includes('SIZE')) colIdx.size = c;
          else if (h.includes('WALL') || h.includes('THICKNESS')) colIdx.thickness = c;
          else if (h.includes('QUANTITY') || h.includes('QTY')) colIdx.qty = c;
          else if (h.match(/UNIT\s*W|U\.\s*WEIG|ACTUAL/)) colIdx.unitWeight = c;
          else if (h.match(/UNIT\s*P|U\.\s*PRICE/i)) colIdx.unitPrice = c;
          else if (h.match(/^TOTAL|T\.AMOUNT|AMOUNT/) && !h.includes('WEIGHT')) colIdx.total = c;
        }
        // Citizen format has NO. in col0, Bestflow has Y in col0
        const isCitizen = cells[0].includes('NO');
        dataStartRow = isCitizen ? r + 1 : r + 2;
        break;
      }
    }

    if (headerRow === -1 || colIdx.desc === -1 || colIdx.qty === -1) {
      console.log('SKIP (no header found):', file);
      totalSkip++;
      continue;
    }

    const csvLines = ['description,size,quantity,unit_price,total_price,unit_weight,item_number'];
    let currentSection = '';
    let itemCounter = 0;

    for (let r = dataStartRow; r <= range.e.r; r++) {
      const rowStr = Array.from({ length: range.e.c + 1 }, (_, c) => getCellStr(r, c))
        .join(' ')
        .toUpperCase();

      // Stop rows
      if (
        (rowStr.includes('TOTAL') &&
          (rowStr.includes('FOB') || rowStr.includes('USD') || rowStr.includes(':'))) ||
        rowStr.includes('NOTES:') ||
        rowStr.includes('PRICE TERM') ||
        rowStr.includes('BANK') ||
        rowStr.includes('REMARK') ||
        rowStr.includes('PAYMENT') ||
        rowStr.includes('DELIVER TIME') ||
        rowStr.includes('PACKING')
      )
        break;

      if (isOldFormat) {
        // Old Bestflow: Description & Size in one column, section headers
        const col1 = getCellStr(r, colIdx.desc);
        const qty = Number(getCell(r, colIdx.qty)) || 0;
        const price = Number(getCell(r, colIdx.unitPrice)) || 0;

        if (col1.toUpperCase().includes('MATERIAL')) continue;
        if (col1 && qty <= 0 && !price) {
          currentSection = col1.replace(/[º°]/g, '').replace(/\s+/g, ' ').trim();
          continue;
        }
        if (!col1 || qty <= 0) continue;

        const total = Math.round((Number(getCell(r, colIdx.total)) || 0) * 100) / 100;
        const weight = colIdx.unitWeight >= 0 ? Number(getCell(r, colIdx.unitWeight)) || 0 : 0;
        itemCounter++;
        csvLines.push([currentSection, col1, qty, price, total, weight, itemCounter].join(','));
        continue;
      }

      // Dynamic format: use mapped columns
      const itemNum = getCellStr(r, colIdx.itemNum);
      const descVal = getCellStr(r, colIdx.desc);
      const qtyVal = Number(getCell(r, colIdx.qty)) || 0;

      // Skip material/header rows
      if (descVal.toUpperCase().match(/^(MATERIAL|Q235|CARBON STEEL|A234|FORGED)/)) continue;

      // Section header: has description but no item number and no qty
      if (descVal && !itemNum && qtyVal <= 0) {
        currentSection = descVal.replace(/[º°,]/g, '').replace(/\s+/g, ' ').trim();
        continue;
      }

      if (!itemNum || qtyVal <= 0) continue;

      // Build description
      let desc = '';
      let size = '';

      if (colIdx.size >= 0) {
        // Has separate size column
        size = getCellStr(r, colIdx.size);
        desc = descVal; // e.g., "SORF S-150" or "90D LR ELBOW"
        if (colIdx.thickness >= 0) {
          const thick = getCellStr(r, colIdx.thickness);
          if (thick) desc += ' ' + thick;
        }
      } else {
        // No size column: desc column has size (studs/nuts format)
        // Description is the section header, size is in desc column
        desc = currentSection || descVal;
        size = descVal; // e.g., "1/2"X2-1/2""
      }

      const priceVal = colIdx.unitPrice >= 0 ? Number(getCell(r, colIdx.unitPrice)) || 0 : 0;
      const totalVal =
        colIdx.total >= 0 ? Math.round((Number(getCell(r, colIdx.total)) || 0) * 100) / 100 : 0;
      const weightVal = colIdx.unitWeight >= 0 ? Number(getCell(r, colIdx.unitWeight)) || 0 : 0;

      csvLines.push([desc.trim(), size, qtyVal, priceVal, totalVal, weightVal, itemNum].join(','));
    }

    if (csvLines.length <= 1) {
      console.log('SKIP (no items):', file);
      totalSkip++;
      continue;
    }

    const csvName = `${supplier.replace(/\s+/g, '')}_${proformaNum.replace(/\s+/g, '')}_${date}.csv`;
    fs.writeFileSync(path.join(outDir, csvName), csvLines.join('\n'), 'utf-8');
    console.log(`OK (${csvLines.length - 1} items): ${csvName}`);
    totalOk++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`ERROR: ${file} - ${msg}`);
    totalSkip++;
  }
}

console.log(`\nDone! ${totalOk} CSVs generated, ${totalSkip} skipped.`);
console.log('Output:', outDir);
