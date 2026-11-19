import React from 'react';

// El label y el control comparten este id: asociarlos explícitamente es lo que
// hace que un lector de pantalla anuncie "Título" y no sólo "cuadro de texto".
// `Input`, `Textarea` y `Select` lo consumen; los controles compuestos que no
// lo usen conservan el label visible, como antes. `messageId` apunta al error
// o a la ayuda debajo del control, para que se lean junto con el label.
export const FieldContext = React.createContext(null);
