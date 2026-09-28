// Formato es-AR con símbolo, compartido entre la página y el detalle por persona
// (ver front/src/design-system/readme.md#fundamentos-de-contenido, "Números").
export const formatMoney = (value: number): string => `$ ${value.toLocaleString("es-AR")}`;
