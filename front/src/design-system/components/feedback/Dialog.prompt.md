Use `Dialog` for short, self-contained tasks. Anything longer than ~6 fields becomes its own screen.

```jsx
<Dialog open={open} title="Nuevo libro" onClose={close} footer={<><Button variant="secondary" onClick={close}>Cancelar</Button><Button>Guardar</Button></>}> … </Dialog>
```

The overlay is `position:fixed`: it always covers the full viewport and stays centred no matter where the page is scrolled, so it can be rendered from anywhere (no need to wrap it in a `position:relative` parent).
