import React from 'react';
import { Checkbox } from '../forms/Checkbox.jsx';

const defaultRowKey = (r, i) => r.id ?? r.isbn ?? i;

export function Table({ columns=[], rows=[], selectable, dense, onRowClick, empty, style, selectedKeys, onSelectionChange, rowKey=defaultRowKey, ...rest }) {
  const [hover,setHover] = React.useState(-1);
  const pad = dense ? '8px 12px' : '11px 16px';
  const keys = rows.map(rowKey);
  const allSelected = selectable && rows.length > 0 && keys.every(k => selectedKeys?.has(k));
  const someSelected = selectable && !allSelected && keys.some(k => selectedKeys?.has(k));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set() : new Set(keys));
  };
  const toggleRow = (key) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  return (
    <div style={{overflowX:'auto',...style}} {...rest}>
      <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)',fontSize:'var(--text-sm)'}}>
        <thead>
          <tr>
            {selectable ? (
              <th style={{width:40, padding:pad, background:'var(--papel-50)', borderBottom:'1px solid var(--border-subtle)'}}>
                <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
              </th>
            ) : null}
            {columns.map((c,i)=>(
              <th key={i} style={{
                textAlign: c.align || 'left', padding:pad, whiteSpace:'nowrap',
                fontSize:'var(--text-2xs)', fontWeight:'var(--weight-semibold)',
                letterSpacing:'var(--tracking-caps)', textTransform:'uppercase',
                color:'var(--text-muted)', background:'var(--papel-50)',
                borderBottom:'1px solid var(--border-subtle)',
                width: c.width,
              }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length + (selectable ? 1 : 0)} style={{padding:'var(--space-10)',textAlign:'center',color:'var(--text-subtle)'}}>{empty || 'Sin registros'}</td></tr>
          ) : rows.map((r,ri)=>{
            const key = keys[ri];
            return (
            <tr key={ri}
              onMouseEnter={()=>setHover(ri)} onMouseLeave={()=>setHover(-1)}
              onClick={onRowClick ? ()=>onRowClick(r,ri) : undefined}
              style={{
                background: hover===ri ? 'var(--papel-50)' : 'transparent',
                cursor: onRowClick ? 'pointer' : 'default',
                transition:'background-color var(--dur-instant) var(--ease-standard)',
              }}>
              {selectable ? (
                <td style={{padding:pad, borderBottom:'1px solid var(--border-subtle)'}} onClick={(e)=>e.stopPropagation()}>
                  <Checkbox checked={!!selectedKeys?.has(key)} onChange={()=>toggleRow(key)} />
                </td>
              ) : null}
              {columns.map((c,ci)=>(
                <td key={ci} style={{
                  padding:pad, textAlign: c.align || 'left',
                  borderBottom:'1px solid var(--border-subtle)',
                  color: c.muted ? 'var(--text-muted)' : 'var(--text-body)',
                  fontFamily: c.mono ? 'var(--font-mono)' : 'inherit',
                  fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : undefined,
                  whiteSpace: c.wrap ? 'normal' : 'nowrap',
                }}>{c.cell ? c.cell(r,ri) : r[c.key]}</td>
              ))}
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}
