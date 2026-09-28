Use `SidebarNav` as the app's only primary navigation. Mix `{section}` dividers with link items.

```jsx
<SidebarNav value={view} onChange={setView} items={[
  {value:'inicio',label:'Inicio',icon:'layout-dashboard'},
  {section:'Catálogo'},
  {value:'libros',label:'Libros',icon:'book-open',badge:168},
]} />
```

Set `logoSrc` when the file isn't two levels below the design-system root.
