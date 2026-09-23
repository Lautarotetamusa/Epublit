export * from "./users.schema";
export * from "./personas.schema";
export * from "./clientes.schema";
export * from "./libros.schema";
export * from "./libroCliente.schema";
export * from "./librosPersonas.schema";
export * from "./transacciones.schema";
export * from "./librosTransacciones.schema";
export * from "./precioLibroCliente.schema";
export * from "./precioLibros.schema";
export * from "./ventas.schema";

// Nota: la tabla `users` en MySQL tiene un trigger (`crear_clientes_por_usuario`)
// que crea automáticamente los clientes "MOSTRADOR" y "CONSUMIDOR FINAL" al
// insertar un usuario. Drizzle no modela triggers de forma declarativa; cuando
// se migre el módulo `user`, esa lógica pasa al `user.service.ts` (dentro de la
// misma transacción de creación del usuario).
