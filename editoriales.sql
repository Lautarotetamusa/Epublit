ALTER TABLE libros ADD editorial VARCHAR(64);

UPDATE libros
SET editorial = "NIÑO"
WHERE isbn IN (
    9789569569319,
    9789569569326,
    9789569569333,
    9789569569357,
    9789569569364,
    9789569569050,
    9789569569135,
    9788494518911,
    9789569569074,
    9789569569067,
    9789569569043,
    9789569569166,
    9789569569197,
    9789569569190,
    9789569569258,
    9789569569272,
    9789569569265,
    9789569569111,
    9789569569227,
    9789569569005,
    9789569569098,
    9789569569302,
    9789569569104,
    9789569569203,
    9789569569012,
    9789569569289,
    9789569569173,
    9789569569142,
    9789569569241,
    9789569569234,
    9789569569081,
    9789569569029,
    9789569569210,
    9789569569159
);

UPDATE libros
SET editorial = "TERRAZA"
WHERE isbn IN (
    9789872816407,
    9789873327285,
    9789874569813,
    9789874569820,
    9789874569837,
    9789874569851,
    9789874569868,
    9789874569875,
    9789874569882,
    9789874569899,
    9789874642820,
    9789874642837,
    9789874642844,
    9789874642868,
    9789874642899,
    9789874991003,
    9789874991010,
    9789874991027,
    9789874991034,
    9789874991041,
    9789874991058,
    9789874991065,
    9789874991126,
    9789874991171,
    9789874991188,
    9789874991195,
    9789874991218,
    9789874991225,
    9789874991232,
    9789874991249,
    9789874991256,
    9789874991294,
    9789874991300,
    9789874991331,
    9789874991348,
    9789878638362,
    9789878663685,
    9789878698335
);

UPDATE libros
SET editorial = "SILVESTRES"
WHERE editorial IS NULL;

mysql -h epublit.com.ar --port=3306 -u teti -pLautaro123. -D librossilvestres -e '' > archivos/ventas_parana.csv

/*Ventas de cada editorial*/
SELECT L.isbn, L.titulo, cantidad, precio, descuento, fecha, id_venta, 
IF(medio_pago=0, "efectivo", IF(medio_pago=1, "debito", IF(medio_pago=2, "credito", IF(medio_pago=3, "mercadopago", "transferencia")))) as medio_pago
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "SILVESTRES";

/*Cantidad vendido de cada libro*/
SELECT L.isbn, L.titulo, sum(cantidad), sum(cantidad*precio-cantidad*descuento*precio/100) as total_por_libro
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "SILVESTRES"
GROUP BY L.isbn;

/*Total vendido por editorial*/
SELECT sum(cantidad*precio-cantidad*descuento*precio/100) as total_vendido
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "NIÑO";

/*Ventas de silvestres despues del 16/08/2023*/
SELECT L.isbn, L.titulo, cantidad, precio, descuento, fecha, id_venta, 
IF(medio_pago=0, "efectivo", IF(medio_pago=1, "debito", IF(medio_pago=2, "credito", IF(medio_pago=3, "mercadopago", "transferencia")))) as medio_pago
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "SILVESTRES" AND
fecha >= "2023-08-15";

/* Cantidad vendido de cada libro para silvestres despues del 16/08/2023 */
SELECT L.isbn, L.titulo, sum(cantidad) as total_vendido, sum(cantidad*precio-cantidad*descuento*precio/100) as total_por_libro
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "SILVESTRES" AND
fecha >= "2023-08-15"
GROUP BY L.isbn
ORDER BY total_vendido DESC;

SELECT sum(cantidad*precio-cantidad*descuento*precio/100) as total_vendido
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "SILVESTRES" AND
fecha >= "2023-08-15";


/*Ventas de silvestres despues del 18/08/2023*/
SELECT L.isbn, L.titulo, cantidad, precio, descuento, fecha, id_venta, 
IF(medio_pago=0, "efectivo", IF(medio_pago=1, "debito", IF(medio_pago=2, "credito", IF(medio_pago=3, "mercadopago", "transferencia")))) as medio_pago
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "SILVESTRES" AND
fecha >= "2023-08-18"
ORDER BY fecha ASC, medio_pago ASC;

SELECT L.isbn, L.titulo, cantidad, precio as PVP, descuento, (cantidad*precio-cantidad*precio*descuento/100) as total_venta, fecha, id_venta, 
IF(medio_pago=0, "efectivo", IF(medio_pago=1, "debito", IF(medio_pago=2, "credito", IF(medio_pago=3, "mercadopago", "transferencia")))) as medio_pago
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "TERRAZA" AND
fecha >= "2023-08-18"
ORDER BY fecha ASC, medio_pago ASC;


SELECT L.isbn, L.titulo, sum(cantidad) as total_vendido, sum(cantidad*precio-cantidad*descuento*precio/100) as total_por_libro
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "SILVESTRES" AND
fecha >= "2023-08-18"
GROUP BY L.isbn
ORDER BY total_vendido DESC;

SELECT sum(cantidad*precio-cantidad*descuento*precio/100) as total_vendido
FROM libros_ventas LV
INNER JOIN libros L
ON L.isbn = LV.isbn
INNER JOIN ventas V
ON V.id = LV.id_venta
WHERE editorial = "SILVESTRES" AND
fecha >= "2023-08-18";