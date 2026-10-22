Use `Card` to group anything on a page. Never nest cards; use a divider instead.

```jsx
<Card title="Liquidaciones" subtitle="Últimos 30 días" actions={<Button variant="secondary" size="sm">Ver todas</Button>}>
  …
</Card>
```

Pass `padded={false}` when the body is a `Table` so rows reach the card edge.
