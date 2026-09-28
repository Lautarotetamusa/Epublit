import React from 'react';

// Mapa nombre -> URL final del asset, resuelto por Vite en build time
// (hasheado) y en dev (servido tal cual). Un string relativo suelto
// ('../../assets/icons/' + name + '.svg') se resolvería contra la URL de
// la página, no del módulo, y rompería apenas la app tiene rutas.
const iconUrls = import.meta.glob('../../assets/icons/*.svg', { eager: true, query: '?url', import: 'default' });

function resolveIconUrl(name) {
  const entry = Object.entries(iconUrls).find(([path]) => path.endsWith('/' + name + '.svg'));
  return entry ? entry[1] : undefined;
}

/** Renders a Lucide SVG from assets/icons as a currentColor-tintable mask. */
export function Icon({ name, size = 18, color = 'currentColor', style, ...rest }) {
  const resolved = resolveIconUrl(name);
  const url = resolved ? 'url("' + resolved + '")' : undefined;
  return (
    <span
      aria-hidden="true"
      {...rest}
      style={{
        display: 'inline-block', width: size, height: size, flex: '0 0 auto',
        background: color, WebkitMaskImage: url, maskImage: url,
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center', maskPosition: 'center', ...style,
      }}
    />
  );
}
