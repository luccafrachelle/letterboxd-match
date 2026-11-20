# letterboxd-match

Compara dos perfiles de Letterboxd: pelis **vistas en común** y pelis que están en la **watchlist de los dos** (para ver juntos). Muestra las tablas (con filtro y orden) y exporta a Excel.

Link compartible: `/?a=usuario1&b=usuario2`.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:4321
```

## Deploy

Astro SSR con `@astrojs/vercel`. Importar el repo en Vercel (framework Astro, sin configuración extra) o `npx vercel --prod`.

## CLI

```bash
node scripts/common.ts usuarioA usuarioB [salida.xlsx]
```

El Excel tiene las hojas "Vistas en común" (título, año, link, rating de cada uno), "Para ver juntos" y "Resumen".

## Limitación conocida

Letterboxd (Cloudflare) bloquea las consultas automáticas a `/<user>/films/page/2/` en adelante, así que de las
pelis vistas solo se leen las primeras 72 de cada perfil; la web lo avisa. La watchlist se lee completa.
