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


select * from precio_libro_cliente where id_cliente=42 and id_libro=127;

select * from libro_cliente where id_cliente=42;


SELECT 
titulo, L.id_libro, L.isbn, PLC.precio, LC.stock
FROM precio_libro_cliente as PLC
INNER JOIN (
    SELECT id_libro, MAX(created_at) as last_date
    FROM precio_libro_cliente PLC
    WHERE PLC.created_at < '2024-07-14T11:06:51'
    AND PLC.id_cliente = 42
    GROUP BY id_libro
) AS LP
ON  LP.id_libro = PLC.id_libro
AND LP.last_date = PLC.created_at
AND PLC.id_cliente = 42
INNER JOIN libros L
ON L.id_libro = PLC.id_libro
INNER JOIN libro_cliente as LC
ON LC.id_libro = PLC.id_libro

