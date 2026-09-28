Use `Icon` for every glyph in an Epublit interface — never inline hand-drawn SVG or emoji.

```jsx
<Icon name="book-open" size={18} />
<Icon name="triangle-alert" size={16} color="var(--text-error)" />
```

Set `base` when the consuming file is not two levels below the design-system root (default `../../assets/icons/`). Available stems are the files in `assets/icons/`.
