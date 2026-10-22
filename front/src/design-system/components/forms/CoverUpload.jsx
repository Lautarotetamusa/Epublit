import React from 'react';
import { Icon } from '../core/Icon.jsx';

// Tapas de libro: el único material fotográfico previsto por el sistema
// (ver design-system/readme.md, sección Imágenes) — vertical, sobre fondo
// papel, con sombra corta. Sin imagen, el marcador usa el mismo
// tratamiento que el kit del sitio: isotipo sobre pino-800.
export function CoverUpload({ value, onSelect, onRemove, invalid, disabled, style, ...rest }) {
  const inputRef = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(false);

  const openPicker = () => !disabled && inputRef.current?.click();

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onSelect(file);
  };

  return (
    <div
      {...rest}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', ...style }}
    >
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={value ? 'Cambiar portada' : 'Subir portada'}
        onClick={openPicker}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
        onDragOver={(e) => { e.preventDefault(); !disabled && setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); !disabled && handleFiles(e.dataTransfer.files); }}
        style={{
          width: 120, height: 168, flex: '0 0 auto', overflow: 'hidden', cursor: disabled ? 'not-allowed' : 'pointer',
          borderRadius: 'var(--radius-md)', border: '1px solid ' + (invalid ? 'var(--border-error)' : dragOver ? 'var(--pino-500)' : 'var(--border-subtle)'),
          boxShadow: dragOver ? 'var(--ring-focus)' : 'var(--shadow-xs)',
          background: value ? 'var(--papel-0)' : 'var(--pino-800)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'var(--transition-control)',
        }}
      >
        {value ? (
          <img src={value} alt="Portada del libro" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon name="book-marked" size={28} color="var(--papel-0)" style={{ opacity: 0.55 }} />
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
          {value ? 'Cambiar portada' : 'Subir portada'}
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
          JPG o PNG, vertical. Máximo 5 MB.
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
