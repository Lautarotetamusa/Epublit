Use `StatCard` in a 3–4 column grid at the top of a dashboard. Keep values short; move detail to a table below.

```jsx
<StatCard label="Ventas del mes" value="$ 1.842.500" delta="+12% vs. mes anterior" icon="banknote" />
```

Cuando la cifra va adentro de una tarjeta que ya existe —una fila de métricas
separadas por divisores, por ejemplo— se pasa `variant="bare"`: la cifra deja de
dibujar su propio marco para no anidar tarjetas.

```jsx
<StatCard variant="bare" label="Ingreso generado" value="$ 1.842.500" delta={<Badge tone="success" icon="arrow-up-right">+12,4%</Badge>} />
```
