Use `Input` inside a `Field`. Set `invalid` together with the Field's `error`.

```jsx
<Input iconStart="search" placeholder="Buscar por título, autor o ISBN" />
<Input suffix="ARS" defaultValue="18500" />
<Input mono readOnly value="epk_live_..." />
```

Set `mono` when the value is data — API keys, tracking codes, ISBN — so it reads in JetBrains Mono like the rest of the tabular data.
