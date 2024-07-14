ALTER TABLE ventas ADD COLUMN file_path VARCHAR(80) NOT NULL;

ALTER TABLE clientes MODIFY COLUMN cuit VARCHAR(15) DEFAULT NULL;

CREATE TABLE consignaciones(
    id INT(11) NOT NULL AUTO_INCREMENT,
    id_cliente INT(11) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    remito_path VARCHAR(80) NOT NULL,

    PRIMARY KEY(id),
    FOREIGN KEY(id_cliente) REFERENCES clientes(id)
);

CREATE TABLE libros_consignaciones(
    isbn VARCHAR(13) NOT NULL,
    id_consignacion INT(11) NOT NULL,
    stock INT NOT NULL,

    PRIMARY KEY (isbn, id_consignacion),
    FOREIGN KEY (isbn) REFERENCES libros(isbn),
    FOREIGN KEY (id_consignacion) REFERENCES consignaciones(id)
);

CREATE TABLE stock_cliente(
    id_cliente INT(11) NOT NULL,
    isbn VARCHAR(13) NOT NULL,

    stock INT NOT NULL,

    PRIMARY KEY (isbn, id_cliente),
    FOREIGN KEY (isbn) REFERENCES libros(isbn),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);

ALTER TABLE clientes DROP COLUMN cond_fiscal;
ALTER TABLE clientes ADD cond_fiscal VARCHAR(50) NOT NULL;
ALTER TABLE clientes ADD razon_social VARCHAR(50) NOT NULL;
ALTER TABLE clientes ADD domicilio VARCHAR(100) NOT NULL;


ALTER TABLE clientes MODIFY cond_fiscal VARCHAR(50) DEFAULT NULL;
ALTER TABLE clientes MODIFY razon_social VARCHAR(50) DEFAULT NULL;
ALTER TABLE clientes MODIFY domicilio VARCHAR(100) DEFAULT NULL;