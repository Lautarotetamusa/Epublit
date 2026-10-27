Use `Timeline` to tell the history of one record — the order's journey from
payment to delivery, the movements of a deposit, a liquidation's milestones.
It is a record of what already happened, not a stepper of future steps.

```jsx
<Timeline
  items={[
    { title: 'Pedido recibido', timestamp: '20/10/2026, 10:20', tone: 'done' },
    { title: 'Pago aprobado', timestamp: '20/10/2026, 10:22', tone: 'done' },
    { title: 'Pedido aceptado', description: 'Se generó la venta #981 y la Factura B.', timestamp: '20/10/2026, 10:35', tone: 'current' }
  ]}
/>
```

Use `tone="error"` only for a closing milestone that means the record stopped
(rejected, cancelled, refunded); `pending` is for a milestone that was expected
but never happened.
