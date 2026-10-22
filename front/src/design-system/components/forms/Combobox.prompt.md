Use `Combobox` instead of `Select` once the list gets long (clientes, catálogo) and picking by scrolling stops being practical, or when some options must stay visible but not selectable (mark them `disabled`, don't filter them out — e.g. a book with 0 stock).

```jsx
<Combobox
  value={clienteId}
  options={clientes.map((c) => ({ value: String(c.id), label: c.nombre }))}
  placeholder="Buscá un cliente"
  onChange={setClienteId}
/>
```
