ALTER TABLE libros_consignaciones
    DROP PRIMARY KEY,
    DROP FOREIGN KEY libros_consignaciones_ibfk_2,
    ADD COLUMN id_libro INT NOT NULL;

update libros_consignaciones lc
inner join consignaciones c
    on c.id = lc.id_consignacion
inner join libros l
    on  l.isbn = lc.isbn 
    and l.user = c.user 
set lc.id_libro = l.id_libro;

ALTER TABLE libros_consignaciones
    ADD CONSTRAINT FOREIGN KEY (id_libro) REFERENCES libros(id_libro),
    ADD PRIMARY KEY (id_libro, id_consignacion);

