import React from 'react';

// El label y el control comparten este id: asociarlos explícitamente es lo que
// hace que un lector de pantalla anuncie "Título" y no sólo "cuadro de texto".
// `Input`, `Textarea` y `Select` lo consumen; los controles compuestos que no
// lo usen conservan el label visible, como antes.
export const FieldContext = React.createContext(null);
