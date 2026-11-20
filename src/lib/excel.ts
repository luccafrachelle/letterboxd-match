import ExcelJS from 'exceljs';
import type { CommonFilm, CompareResult } from './compare.ts';

const stars = (r: number | null) => (r == null ? '' : '★'.repeat(Math.floor(r)) + (r % 1 ? '½' : ''));

function filmSheet(wb: ExcelJS.Workbook, name: string, films: CommonFilm[], ratingCols: [string, string] | null) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Título', key: 'title', width: 45 },
    { header: 'Año', key: 'year', width: 8 },
    { header: 'Link Letterboxd', key: 'url', width: 55 },
    ...(ratingCols
      ? [
          { header: `Rating ${ratingCols[0]}`, key: 'ratingA', width: 16 },
          { header: `Rating ${ratingCols[1]}`, key: 'ratingB', width: 16 },
        ]
      : []),
  ];
  for (const f of films) {
    const row = ws.addRow({
      title: f.title,
      year: f.year,
      url: f.url ? { text: f.url, hyperlink: f.url } : '',
      ratingA: stars(f.ratingA),
      ratingB: stars(f.ratingB),
    });
    row.getCell('url').font = { color: { argb: 'FF0563C1' }, underline: true };
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF202830' } };
  const lastCol = ratingCols ? 'E' : 'C';
  ws.autoFilter = { from: 'A1', to: `${lastCol}${Math.max(1, films.length + 1)}` };
}

export async function buildWorkbook(res: CompareResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'letterboxd-match';
  wb.created = new Date(res.generatedAt);

  filmSheet(wb, 'Vistas en común', res.common, [res.userA, res.userB]);
  filmSheet(wb, 'Para ver juntos', res.watchlistCommon, null);

  const sum = wb.addWorksheet('Resumen');
  sum.columns = [
    { header: 'Dato', key: 'k', width: 40 },
    { header: 'Valor', key: 'v', width: 28 },
  ];
  sum.getRow(1).font = { bold: true };
  const minTotal = Math.min(res.totalA, res.totalB) || 1;
  sum.addRows([
    { k: `Pelis vistas por ${res.userA}`, v: res.totalA },
    { k: `Pelis vistas por ${res.userB}`, v: res.totalB },
    { k: 'Vistas en común', v: res.common.length },
    { k: '% en común (sobre el que vio menos)', v: `${((res.common.length / minTotal) * 100).toFixed(1)}%` },
    { k: `Watchlist de ${res.userA}`, v: res.watchlistTotalA },
    { k: `Watchlist de ${res.userB}`, v: res.watchlistTotalB },
    { k: 'En la watchlist de los dos (para ver juntos)', v: res.watchlistCommon.length },
    ...res.warnings.map((w) => ({ k: '⚠ Incompleto', v: w })),
    { k: 'Generado', v: new Date(res.generatedAt).toLocaleString('es-UY') },
  ]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
