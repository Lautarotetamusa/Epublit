Use `SegmentedControl` instead of `Select` for a small fixed set (2-4) of mutually exclusive options that are worth showing up front instead of hiding behind a dropdown — tipo de venta, un filtro de estado.

```jsx
<SegmentedControl
  value={tipoVenta}
  options={[{ value: 'firme', label: 'Venta en firme' }, { value: 'consignacion', label: 'Sobre consignación' }]}
  onChange={setTipoVenta}
/>
```
