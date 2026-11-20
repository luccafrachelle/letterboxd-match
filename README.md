# Para ver juntos

Poné dos perfiles de Letterboxd y encontrá las pelis que están en la **watchlist de los dos**.
Muestra los posters, deja buscar, ordenar, elegir una al azar y descargar la lista en Excel.

Link compartible: `/?a=usuario1&b=usuario2`.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:4321
```

## Deploy

Astro SSR con `@astrojs/vercel`:

```bash
npx vercel --prod
```

## CLI

```bash
node scripts/common.ts usuarioA usuarioB [salida.xlsx]
```

## Notas

- Las watchlists se leen completas desde los perfiles públicos.
- Los posters salen del CDN de imágenes de Letterboxd; si no está ahí se usa la imagen del artículo de Wikipedia, y si tampoco, un afiche generado.
