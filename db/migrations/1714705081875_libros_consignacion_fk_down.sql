ALTER TABLE libros_consignaciones
    DROP PRIMARY KEY,
    DROP CONSTRAINT libros_consignaciones_ibfk_2;
    DROP COLUMN id_libro,
    ADD FOREIGN KEY (isbn) REFERENCES libros(isbn),
    ADD PRIMARY KEY (isbn, id_consignacion);
