ALTER TABLE stock_cliente
    DROP CONSTRAINT stock_cliente_ibfk_1,
    ADD COLUMN id_libro INT NOT NULL,
    ADD COLUMN precio FLOAT NOT NULL;

update stock_cliente p
inner join libros l
    on l.isbn = p.isbn 
set p.id_libro = l.id_libro,
    p.precio = l.precio;

alter table stock_cliente
    drop primary key;

ALTER TABLE stock_cliente
    ADD CONSTRAINT FOREIGN KEY (id_libro) REFERENCES libros(id_libro),
    ADD PRIMARY KEY (id_libro, id_cliente);

ALTER TABLE stock_cliente RENAME libro_cliente;

CREATE TABLE IF NOT EXISTS precio_libro_cliente (
    id INT NOT NULL AUTO_INCREMENT,
    id_libro int(11) NOT NULL,
    id_cliente int(11) NOT NULL,
    precio float NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (precio >= 0),

    FOREIGN KEY (id_libro) REFERENCES libros(id_libro),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id),
    PRIMARY KEY (id)
);
