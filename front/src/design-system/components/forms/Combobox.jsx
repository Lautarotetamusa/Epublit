import React from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../core/Icon.jsx';

export function Combobox({ value, options=[], placeholder, emptyMessage='Sin resultados', onChange, disabled, invalid, size='md', style, ...rest }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const [menuRect, setMenuRect] = React.useState(null);
  const wrapRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const h = size === 'sm' ? 'var(--height-control-sm)' : 'var(--height-control)';

  const selected = options.find(o => o.value === value);
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const close = () => { setOpen(false); setQuery(''); };

  const commit = (opt) => {
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    close();
  };

  // El menú se porta a `document.body` (ver abajo) para no quedar recortado
  // por el `overflow:hidden` de Card u otro ancestro; sin eso su posición
  // `absolute` queda contenida igual, pero el recorte visual pasa por
  // encima de esa positioning context. Se recalcula la posición del input
  // en cada apertura y mientras esté abierto (scroll/resize).
  React.useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  React.useEffect(() => { setHighlight(0); }, [query, open]);

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(filtered[highlight]); }
    else if (e.key === 'Escape') { close(); }
  };

  return (
    <div ref={wrapRef} {...rest} style={{ position: 'relative', ...style }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: h, padding: '0 10px',
        background: disabled ? 'var(--papel-100)' : 'var(--papel-0)',
        border: '1px solid ' + (invalid ? 'var(--border-error)' : focused ? 'var(--pino-500)' : 'var(--border-default)'),
        borderRadius: 'var(--radius-sm)',
        boxShadow: focused ? 'var(--ring-focus)' : 'var(--shadow-inset)',
        transition: 'var(--transition-control)',
      }}>
        <Icon name="search" size={15} color="var(--text-subtle)" />
        <input
          value={open ? query : (selected ? selected.label : '')}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-body)', fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
            color: 'var(--text-body)',
          }}
        />
        <Icon name="chevron-down" size={15} color="var(--text-subtle)" />
      </div>
      {open && !disabled && menuRect ? createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: menuRect.top, left: menuRect.left, width: menuRect.width, zIndex: 70,
          maxHeight: 240, overflowY: 'auto', background: 'var(--papel-0)',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px', fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>{emptyMessage}</div>
          ) : filtered.map((o, i) => (
            <div key={o.value}
              onMouseDown={(e) => { e.preventDefault(); commit(o); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 10px', fontSize: 'var(--text-sm)',
                cursor: o.disabled ? 'not-allowed' : 'pointer',
                color: o.disabled ? 'var(--text-subtle)' : 'var(--text-body)',
                background: o.disabled ? 'transparent' : i === highlight ? 'var(--surface-hover)' : (o.value === value ? 'var(--papel-50)' : 'transparent'),
              }}
            >{o.label}</div>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}
