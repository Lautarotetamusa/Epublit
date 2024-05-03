ALTER TABLE libros
    DROP PRIMARY KEY,
    ADD COLUMN id_libro INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ADD KEY(isbn, user);

ALTER TABLE libros_ventas
    DROP CONSTRAINT libros_ventas_ibfk_2,
    ADD COLUMN id_libro INT NOT NULL;

update libros_ventas lv
inner join ventas c
    on c.id = lv.id_venta
inner join libros l
    on  l.isbn = lv.isbn 
    and l.user = c.user 
set lv.id_libro = l.id_libro;

ALTER TABLE libros_ventas
    ADD CONSTRAINT FOREIGN KEY (id_libro) REFERENCES libros(id_libro);
