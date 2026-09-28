import React from 'react';
import { Icon } from '../core/Icon.jsx';

// Lee el ancho/alto real de una imagen sin depender de que ya esté montada
// en el DOM — hace falta antes de aceptar el archivo, para poder rechazarlo
// si no llega a la resolución mínima configurada.
function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen elegida.')); };
    img.src = url;
  });
}

// Foto de persona (autor/ilustrador): segundo material fotográfico del
// sistema junto a la tapa de libro (ver design-system/readme.md, sección
// Imágenes), pero circular en vez de vertical — mismo criterio de "pill
// exclusivamente en avatares" que ya rige Avatar. Sin foto, el marcador
// reusa el tratamiento de Avatar (fondo pino-100, ícono en vez de
// iniciales porque acá no hay nombre disponible como fallback de texto).
// No se pide que la imagen sea cuadrada ni se ofrece recorte manual: igual
// que CoverUpload con la portada, `object-fit: cover` la centra y recorta
// visualmente dentro del marcador (ver "Decisiones de formato" en
// specs/004-persona-foto-bio/design.md).
//
// `maxSizeMb`/`minWidthPx`/`minHeightPx` no vienen fijos acá: quien use el
// componente los pasa desde donde sea que se configuren (ver
// "Datos necesarios" en specs/004-persona-foto-bio/design.md — la
// editorial los edita en Perfil). Sin esas props, el componente no
// rechaza nada por tamaño ni resolución.
export function PhotoUpload({ value, onSelect, onRemove, onRejected, maxSizeMb, minWidthPx, minHeightPx, invalid, disabled, style, ...rest }) {
  const inputRef = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(false);
  // Un objectURL vencido (ej. sesión vieja) rompe el <img>: sin este
  // fallback, el navegador muestra el ícono roto + el `alt` desbordando el
  // círculo en vez del placeholder normal. `value` falsy ya alcanza para
  // volver a mostrar el ícono (ver `showPhoto`), así que sólo hace falta
  // resetear la bandera cuando entra un archivo nuevo.
  const [imgFailed, setImgFailed] = React.useState(false);
  const showPhoto = value && !imgFailed;

  const openPicker = () => !disabled && inputRef.current?.click();

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;

    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      onRejected?.(`El archivo pesa más de ${maxSizeMb} MB.`);
      return;
    }

    if (minWidthPx || minHeightPx) {
      let dimensions;
      try {
        dimensions = await readImageDimensions(file);
      } catch (err) {
        onRejected?.(err.message);
        return;
      }
      const anchoInsuficiente = minWidthPx && dimensions.width < minWidthPx;
      const altoInsuficiente = minHeightPx && dimensions.height < minHeightPx;
      if (anchoInsuficiente || altoInsuficiente) {
        onRejected?.(`La imagen tiene que medir al menos ${minWidthPx ?? dimensions.width}×${minHeightPx ?? dimensions.height}px.`);
        return;
      }
    }

    setImgFailed(false);
    onSelect(file);
  };

  return (
    <div
      {...rest}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', ...style }}
    >
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={value ? 'Cambiar foto' : 'Subir foto'}
        onClick={openPicker}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
        onDragOver={(e) => { e.preventDefault(); !disabled && setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); !disabled && handleFiles(e.dataTransfer.files); }}
        style={{
          width: 96, height: 96, flex: '0 0 auto', overflow: 'hidden', cursor: disabled ? 'not-allowed' : 'pointer',
          borderRadius: 'var(--radius-pill)', border: '1px solid ' + (invalid ? 'var(--border-error)' : dragOver ? 'var(--pino-500)' : 'var(--border-subtle)'),
          boxShadow: dragOver ? 'var(--ring-focus)' : 'var(--shadow-xs)',
          background: showPhoto ? 'var(--papel-0)' : 'var(--pino-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'var(--transition-control)',
        }}
      >
        {showPhoto ? (
          <img src={value} alt="" onError={() => setImgFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon name="user-round" size={32} color="var(--pino-700)" style={{ opacity: 0.7 }} />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 2 }}>
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 'var(--height-control-sm)', padding: '0 10px',
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-body)', background: 'var(--papel-0)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-xs)', cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.65 : 1, transition: 'var(--transition-control)',
          }}
        >
          <Icon name="upload" size={14} />
          {value ? 'Cambiar foto' : 'Subir foto'}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onRemove?.()}
            disabled={disabled}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 'var(--height-control-sm)', padding: '0 10px',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-error)', background: 'transparent', border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.65 : 1,
            }}
          >
            <Icon name="trash-2" size={14} color="var(--text-error)" />
            Quitar
          </button>
        ) : null}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', maxWidth: 200 }}>
          JPG o PNG. Cualquier proporción: se centra y recorta sola.
          {maxSizeMb ? ` Máximo ${maxSizeMb} MB.` : ''}
          {minWidthPx || minHeightPx ? ` Resolución mínima ${minWidthPx ?? '—'}×${minHeightPx ?? '—'}px.` : ''}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
