Use `ProgressBar` for a measurable share of a total (0–100). It always shows the number in mono beside the bar.

```jsx
<ProgressBar value={40} label="Pagado" />
<ProgressBar value={100} tone="success" label="Pagado" size="sm" />
```

Keep it for real quantities — pagos de una liquidación, stock comprometido — never as decoration. One bar per quantity; if the exact figures matter more than the ratio, use the numbers alone.
