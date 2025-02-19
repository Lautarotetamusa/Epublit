INSERT INTO precio_libro_cliente (id_libro, id_cliente, precio) (
    SELECT LC.id_libro, LC.id_cliente, LC.precio 
    FROM libro_cliente LC
    INNER JOIN libros L
        ON L.id_libro = LC.id_libro
        AND L.precio != LC.precio
        AND LC.id_cliente = 42
);

INSERT INTO precio_libro_cliente (id_libro, id_cliente, precio)
    SELECT LC.id_libro, LC.id_cliente, LC.precio 
    FROM libro_cliente LC
    LEFT JOIN precio_libro_cliente PLC 
        ON  PLC.id_libro = LC.id_libro 
        AND PLC.id_cliente = LC.id_cliente
    WHERE LC.id_cliente = 42
      AND PLC.id_libro IS NULL;

insert into libro_cliente (isbn, id_libro, id_cliente, precio, stock)
values ("3921949219", 13, 42, 2500, 1);


INSERT INTO precio_libro_cliente (id_libro, id_cliente, precio)
    SELECT LC.id_libro, LC.id_cliente, LC.precio 
    FROM libro_cliente LC
    LEFT JOIN precio_libro_cliente PLC 
        ON  PLC.id_libro = LC.id_libro 
        AND PLC.id_cliente = LC.id_cliente
    WHERE PLC.id_libro IS NULL;

select * from libros where isbn="11221"; /*id = 11*/
select * from precio_libro_cliente where id_libro=11;

select * from transacciones where user=1;

select * from precio_libro_cliente where id_cliente=42 and id_libro=17;

select * from libro_cliente where id_cliente=42;

select * from libros where isbn="9789874201096";
select * from precio_libro_cliente where id_libro=17;


SELECT 
titulo, L.id_libro, L.isbn, PLC.precio, LC.stock
FROM precio_libro_cliente as PLC
INNER JOIN (
    SELECT id_libro, MAX(created_at) as last_date
    FROM precio_libro_cliente PLC
    WHERE PLC.created_at < DATE_SUB('2024-07-26T09:57:52.710Z', INTERVAL 3 HOUR)
    AND PLC.id_cliente = 42
    GROUP BY id_libro
) AS LP
    ON  LP.id_libro = PLC.id_libro
    AND LP.last_date = PLC.created_at
    AND PLC.id_cliente = 42
INNER JOIN libros L
    ON L.id_libro = PLC.id_libro
    AND L.user = 1
INNER JOIN libro_cliente as LC
    ON LC.id_libro = PLC.id_libro
    AND LC.id_cliente = PLC.id_cliente;

/* Para la feria */ 
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(25) NOT NULL,
  `password` binary(60) NOT NULL,
  `cuit` varchar(15) NOT NULL,
  `cond_fiscal` varchar(50) NOT NULL,
  `razon_social` varchar(255) NOT NULL,
  `domicilio` varchar(100) NOT NULL,
  `production` tinyint(1) DEFAULT 0,
  `email` varchar(255) DEFAULT '',
  `ingresos_brutos` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_inicio` char(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


update users set cuit = "11111111111" where cuit = "27249804024"; 

CREATE TABLE `clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) NOT NULL,
  `email` varchar(60) DEFAULT '',
  `cuit` varchar(15) DEFAULT NULL,
  `cond_fiscal` varchar(50) NOT NULL,
  `razon_social` varchar(255) NOT NULL,
  `domicilio` varchar(100) NOT NULL,
  `tipo` enum('inscripto','particular','negro') DEFAULT NULL,
  `user` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user` (`user`),
  CONSTRAINT `clientes_ibfk_1` FOREIGN KEY (`user`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=181 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

insert into clientes (user, tipo, nombre, cond_fiscal, razon_social, domicilio) 
values (5, "negro", "MOSTRADOR", "", "", "");

insert into clientes (user, tipo, nombre, cond_fiscal, razon_social, domicilio) 
values (5, "particular", "CONSUMIDOR FINAL", "CONSUMIDOR FINAL", "CONSUMIDOR FINAL", "");

update users set production=1 where cuit = "27249804024";

/* PEZ MENTA */
insert into clientes (user, tipo, nombre, cond_fiscal, razon_social, domicilio) 
values (6, "negro", "MOSTRADOR", "", "", "");

insert into clientes (user, tipo, nombre, cond_fiscal, razon_social, domicilio) 
values (6, "particular", "CONSUMIDOR FINAL", "CONSUMIDOR FINAL", "CONSUMIDOR FINAL", "");

update users set production=1 where id=6;

/**/
select * from transacciones T
inner join ventas V
    on V.id_transaccion = T.id
