import ExcelJS from 'exceljs';
import type { CompareResult } from './compare.ts';

export async function buildWorkbook(res: CompareResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'letterboxd-match';
  wb.created = new Date(res.generatedAt);

  const ws = wb.addWorksheet('Para ver juntos', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Título', key: 'title', width: 45 },
    { header: 'Año', key: 'year', width: 8 },
    { header: 'Link Letterboxd', key: 'url', width: 55 },
  ];
  for (const f of res.watchlistCommon) {
    const row = ws.addRow({ title: f.title, year: f.year, url: f.url ? { text: f.url, hyperlink: f.url } : '' });
    row.getCell('url').font = { color: { argb: 'FF0563C1' }, underline: true };
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF202830' } };
  ws.autoFilter = { from: 'A1', to: `C${Math.max(1, res.watchlistCommon.length + 1)}` };

  const sum = wb.addWorksheet('Resumen');
  sum.columns = [
    { header: 'Dato', key: 'k', width: 40 },
    { header: 'Valor', key: 'v', width: 28 },
  ];
  sum.getRow(1).font = { bold: true };
  sum.addRows([
    { k: `Watchlist de ${res.userA}`, v: res.watchlistTotalA },
    { k: `Watchlist de ${res.userB}`, v: res.watchlistTotalB },
    { k: 'En la watchlist de los dos', v: res.watchlistCommon.length },
    ...res.warnings.map((w) => ({ k: '⚠ Incompleto', v: w })),
    { k: 'Generado', v: new Date(res.generatedAt).toLocaleString('es-UY') },
  ]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
