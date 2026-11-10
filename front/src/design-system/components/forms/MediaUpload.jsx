import React from 'react';
import { Icon } from '../core/Icon.jsx';

// Lee el ancho/alto real de una imagen antes de aceptarla, igual que
// PhotoUpload: el contenido institucional se muestra a ancho completo en la
// landing, así que una imagen chica no se puede detectar después de subida.
function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen elegida.')); };
    img.src = url;
  });
}

// Imagen de contenido (portada de página, bloques, galería): horizontal, a
// diferencia de CoverUpload (vertical) y PhotoUpload (circular). No hay
// material fotográfico provisto por el sistema, así que el marcador vacío es
// deliberadamente neutro: papel + ícono, sin ilustración inventada.
//
// `compact` achica el marcador para poder usarlo dentro de una galería o una
// fila de bloque sin comerse el formulario. La validación es opcional, igual
// que en PhotoUpload: quien usa el componente decide qué límites aplicar.
export function MediaUpload({
  value,
  onSelect,
  onRemove,
  onRejected,
  maxSizeMb,
  minWidthPx,
  minHeightPx,
  compact = false,
  label = 'imagen',
  hint,
  invalid,
  disabled,
  style,
  ...rest
}) {
  const inputRef = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImage = value && !imgFailed;

  const openPicker = () => !disabled && inputRef.current?.click();

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onRejected?.('Elegí un archivo de imagen (JPG, PNG o WebP).');
      return;
    }

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
      if ((minWidthPx && dimensions.width < minWidthPx) || (minHeightPx && dimensions.height < minHeightPx)) {
        onRejected?.(`La imagen tiene que medir al menos ${minWidthPx ?? '—'}×${minHeightPx ?? '—'}px.`);
        return;
      }
    }

    setImgFailed(false);
    onSelect(file);
  };

  const markerWidth = compact ? 128 : 240;
  const markerHeight = compact ? 72 : 135;

  return (
    <div
      {...rest}
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: compact ? 'var(--space-3)' : 'var(--space-4)', ...style }}
    >
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={showImage ? `Cambiar ${label}` : `Subir ${label}`}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        style={{
          width: markerWidth,
          height: markerHeight,
          flex: '0 0 auto',
          overflow: 'hidden',
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderRadius: 'var(--radius-md)',
          border: '1px solid ' + (invalid ? 'var(--border-error)' : dragOver ? 'var(--pino-500)' : 'var(--border-subtle)'),
          boxShadow: dragOver ? 'var(--ring-focus)' : 'var(--shadow-xs)',
          background: showImage ? 'var(--papel-0)' : 'var(--papel-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'var(--transition-control)',
        }}
      >
        {showImage ? (
          <img src={value} alt="" onError={() => setImgFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon name="image" size={compact ? 20 : 28} color="var(--pino-600)" style={{ opacity: 0.55 }} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 2, flex: '1 1 190px', minWidth: 0 }}>
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
          {showImage ? `Cambiar ${label}` : `Subir ${label}`}
        </button>
        {showImage ? (
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
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', maxWidth: compact ? 180 : 220 }}>
          {hint ?? 'JPG, PNG o WebP, horizontal.'}
          {maxSizeMb ? ` Máximo ${maxSizeMb} MB.` : ''}
          {minWidthPx || minHeightPx ? ` Mínimo ${minWidthPx ?? '—'}×${minHeightPx ?? '—'}px.` : ''}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          // Permite volver a elegir el mismo archivo después de quitarlo.
          e.target.value = '';
        }}
      />
    </div>
  );
}
