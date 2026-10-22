Use `Button` for any action. One `primary` per view; pair it with `secondary` for cancel/back.

```jsx
<Button iconStart="plus">Nuevo libro</Button>
<Button variant="secondary" iconStart="download">Exportar</Button>
<Button variant="ghost" size="sm">Cancelar</Button>
```

`variant="accent"` (violet) is reserved for ecommerce / plan-upgrade surfaces. `loading` swaps the start icon for a spinner and disables the control.
