
ALTER TABLE libros_ventas
    DROP CONSTRAINT libros_ventas_ibfk_2;

ALTER TABLE libros
    DROP COLUMN id_libro,
    DROP PRIMARY KEY,
    DROP KEY isbn,
    ADD PRIMARY KEY(isbn, user);

ALTER TABLE libros_ventas
    DROP COLUMN id_libro,
    ADD FOREIGN KEY (isbn) REFERENCES libros(isbn);
