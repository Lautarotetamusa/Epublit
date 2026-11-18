Use `Button` for any action. One `primary` per view; pair it with `secondary` for cancel/back.

```jsx
<Button iconStart="plus">Nuevo libro</Button>
<Button variant="secondary" iconStart="download">Exportar</Button>
<Button variant="ghost" size="sm">Cancelar</Button>
```

`variant="accent"` (violet) is reserved for ecommerce / plan-upgrade surfaces. `loading` swaps the start icon for a spinner and disables the control.

Con `href` renderiza un `<a>` con el mismo estilo (para navegación, como los CTAs de la landing): nunca anidar un `Button` dentro de un `<a>`.

```jsx
<Button href="https://app.epublit.com.ar/register" variant="accent">Crear cuenta</Button>
```
