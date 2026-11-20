// Uso: node scripts/common.ts <userA> <userB> [salida.xlsx]
import { writeFile } from 'node:fs/promises';
import { compareUsers } from '../src/lib/compare.ts';
import { buildWorkbook } from '../src/lib/excel.ts';

const [a, b, out] = process.argv.slice(2);
if (!a || !b) {
  console.error('Uso: node scripts/common.ts <userA> <userB> [salida.xlsx]');
  process.exit(1);
}

const res = await compareUsers(a, b);
for (const w of res.warnings) console.warn(`⚠ ${w}`);
const file = out ?? `para_ver_juntos_${res.userA}_${res.userB}.xlsx`;
await writeFile(file, await buildWorkbook(res));

console.log(`watchlist ${res.userA}: ${res.watchlistTotalA} | watchlist ${res.userB}: ${res.watchlistTotalB} | para ver juntos: ${res.watchlistCommon.length}`);
console.log(`Excel guardado en ${file}`);
