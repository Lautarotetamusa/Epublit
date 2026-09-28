Use `Toast` to confirm a completed action; never for errors the user must fix (use `Alert`).

```jsx
<Toast message="Libro guardado" action="Ver ficha" onClose={dismiss} />
```
