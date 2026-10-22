Use `Table` for every record list. Numbers right-aligned and `mono`; status via `Badge` in a `cell` renderer.

```jsx
<Card padded={false} title="Catálogo">
  <Table columns={[{header:'Título',key:'titulo',wrap:true},{header:'ISBN',key:'isbn',mono:true},{header:'Stock',key:'stock',align:'right',mono:true}]} rows={libros} />
</Card>
```

For bulk actions, add `selectable` + `selectedKeys`/`onSelectionChange` (the row/header checkboxes and "select all" state come free):

```jsx
<Table selectable columns={...} rows={libros} selectedKeys={selected} onSelectionChange={setSelected} rowKey={(l) => l.isbn} />
```
