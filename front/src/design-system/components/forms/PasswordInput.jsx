import React from 'react';
import { Input } from './Input.jsx';
import { IconButton } from '../core/IconButton.jsx';

export function PasswordInput(props) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Input {...props} type={visible ? 'text' : 'password'}
      trailing={
        <IconButton size="sm" icon={visible ? 'eye-off' : 'eye'}
          label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible} onClick={() => setVisible(v => !v)} />
      } />
  );
}
