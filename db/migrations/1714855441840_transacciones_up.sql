CREATE TABLE if not exists transacciones(
    id INT NULL AUTO_INCREMENT,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    id_cliente INT(11) NOT NULL,
    file_path VARCHAR(80) NOT NULL,
    type ENUM("venta","consignacion","ventaConsignacion","devolucion") NOT NULL,
    user int(11) NOT NULL,

    PRIMARY KEY (id),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id),
    FOREIGN KEY (user) REFERENCES users(id)
);

CREATE TABLE if not exists libros_transacciones (
    id_transaccion int(11) NOT NULL,
    id_libro int(11) NOT NULL,
    cantidad int(11) NOT NULL,
    precio float NOT NULL default 0,

    CHECK (precio >= 0),
    CHECK (cantidad > 0),

    PRIMARY KEY (id_libro, id_transaccion),
    FOREIGN KEY (id_transaccion) REFERENCES transacciones (id),
    FOREIGN KEY (id_libro) REFERENCES libros (id_libro)
);

insert into transacciones (fecha, id_cliente, file_path, user, type)
    select fecha, id_cliente, file_path, user, "venta" as type
    from ventas;

delete from libros_ventas
where (id_venta, id_libro) NOT IN (
    select distinct id_venta, id_libro from libros_ventas
);
insert into libros_transacciones (id_libro, id_transaccion, cantidad, precio)
    select distinct id_libro, T.id as id_transacion, LV.cantidad, LV.precio_venta as precio
    from ventas V
    inner join transacciones T
        on T.fecha = V.fecha
    inner join libros_ventas LV
        on LV.id_venta = V.id;

alter table ventas
    add column if not exists id_transaccion int(11) not null;

update ventas V
inner join transacciones T
    on T.fecha = V.fecha
set V.id_transaccion = T.id;

alter table ventas
    add constraint foreign key (id_transaccion) references transacciones(id);

/* Consignaciones */
insert into transacciones (fecha, id_cliente, file_path, user, type)
    select fecha, id_cliente, remito_path as file_path, user, "consignacion" as type
    from consignaciones;

delete from libros_consignaciones
where (id_consignacion, id_libro) NOT IN (
    select distinct id_consignacion, id_libro from libros_consignaciones
);

insert into libros_transacciones (id_libro, id_transaccion, cantidad, precio)
    select distinct id_libro, T.id as id_transacion, LC.cantidad, 0 as precio
    from consignaciones V
    inner join transacciones T
        on T.fecha = V.fecha
    inner join libros_consignaciones LC
        on LC.id_consignacion = V.id;

/*
`id` int(11) NOT NULL AUTO_INCREMENT,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `descuento` float DEFAULT 0,
  `id_cliente` int(11) NOT NULL,
  `total` float NOT NULL,
  `file_path` varchar(80) NOT NULL,
  `medio_pago` enum('efectivo','debito','credito','mercadopago','transferencia') DEFAULT NULL,
  `user` int(11) NOT NULL,
  `tipo_cbte` int(11) NOT NULL,
  `id_transaccion` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id_cliente` (`id_cliente`),
  KEY `user` (`user`),
  KEY `id_transaccion` (`id_transaccion`),
  CONSTRAINT `ventas_ibfk_1` FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id`),
  CONSTRAINT `ventas_ibfk_2` FOREIGN KEY (`user`) REFERENCES `users` (`id`),
  CONSTRAINT `ventas_ibfk_3` FOREIGN KEY (`id_transaccion`) REFERENCES `transacciones` (`id`)
*/

drop table liquidaciones;
drop table if exists libros_ventas;
drop table if exists libros_consignaciones;
alter table ventas
    drop column file_path,
    drop constraint ventas_ibfk_1,
    drop column id_cliente,
    drop constraint ventas_ibfk_2, 
    drop column user,
    drop column fecha,
    drop primary key,
    drop column id,
    add primary key(id_transaccion);
