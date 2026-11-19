Use `PasswordInput` for every password field, inside a `Field`. It is an `Input` with a
toggle that shows or hides what was typed: nobody should have to retype a password blind.

```jsx
<Field label="Contraseña" hint="Mínimo 8 caracteres.">
  <PasswordInput autoComplete="new-password" value={password} onChange={...} />
</Field>
```

Pass `autoComplete="current-password"` on login and `"new-password"` when creating one, so
password managers offer the right thing. Do not add strength meters or rule checklists.
