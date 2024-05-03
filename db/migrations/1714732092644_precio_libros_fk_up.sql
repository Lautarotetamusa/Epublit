ALTER TABLE precio_libros
    DROP CONSTRAINT precio_libros_ibfk_1,
    ADD COLUMN id_libro INT NOT NULL;

update precio_libros p
inner join libros l
    on l.isbn = p.isbn 
set p.id_libro = l.id_libro;

ALTER TABLE precio_libros
    ADD CONSTRAINT FOREIGN KEY (id_libro) REFERENCES libros(id_libro);
