Use `QuantityStepper` instead of a bare numeric `Input` when the value is mostly incremented/decremented by one (cart lines, stock adjustments). Pass `max` to cap it at available stock.

```jsx
<QuantityStepper value={cantidad} min={1} max={stock} onChange={setCantidad} />
```
