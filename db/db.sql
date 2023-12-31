CREATE USER 'teti'@'%' IDENTIFIED BY 'Lautaro123.';
GRANT ALL PRIVILEGES ON *.* TO 'teti'@'%' WITH GRANT OPTION;

CREATE DATABASE IF NOT EXISTS librossilvestres;
USE librossilvestres;

CREATE TABLE users(
    id INT(11) NOT NULL AUTO_INCREMENT,

    username VARCHAR(25) NOT NULL,
    password BINARY(60) NOT NULL,

    cuit VARCHAR(15) DEFAULT NULL,
    cond_fiscal VARCHAR(50) NOT NULL,
    razon_social VARCHAR(255) NOT NULL,
    domicilio VARCHAR(100) NOT NULL,

    PRIMARY KEY (id)
);

CREATE TABLE libros(
    isbn VARCHAR(13) NOT NULL,
    titulo VARCHAR(60) NOT NULL,
    fecha_edicion DATE NOT NULL,
    precio FLOAT NOT NULL,
    stock INT DEFAULT 0,

    is_deleted BOOLEAN DEFAULT false,

    PRIMARY KEY(isbn)
);

CREATE TABLE personas(
    id INT(11) NOT NULL AUTO_INCREMENT,
    dni VARCHAR(8) NOT NULL,
    nombre VARCHAR(60) NOT NULL,
    email  VARCHAR(60) DEFAULT "", 

    is_deleted BOOLEAN DEFAULT false,

    PRIMARY KEY (id)
);

CREATE TABLE libros_personas(
    isbn VARCHAR(13) NOT NULL,
    id_persona INT(11) NOT NULL,
    tipo TINYINT DEFAULT 0 NOT NULL,
    porcentaje FLOAT DEFAULT 0,

    PRIMARY KEY (isbn, id_persona, tipo),
    FOREIGN KEY (isbn) REFERENCES libros(isbn),
    FOREIGN KEY (id_persona) REFERENCES personas(id)
);

CREATE TABLE clientes(
    id INT(11) NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(60) NOT NULL, 
    email VARCHAR(60) DEFAULT "",

    cuit VARCHAR(15) DEFAULT NULL,
    cond_fiscal VARCHAR(50) NOT NULL,
    razon_social VARCHAR(255) NOT NULL,
    domicilio VARCHAR(100) NOT NULL,

    tipo TINYINT DEFAULT 0,

    PRIMARY KEY(id)
);

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
    cantidad INT NOT NULL,

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

CREATE TABLE ventas(
    id INT(11) NOT NULL AUTO_INCREMENT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    descuento FLOAT DEFAULT 0,
    medio_pago TINYINT DEFAULT 0,
    id_cliente INT(11) NOT NULL,
    total FLOAT NOT NULL,

    /*file path tipico 2023_02_23_165323_27249804024.pdf --> 33 caracteres*/ 
    file_path VARCHAR(80) NOT NULL,

    PRIMARY KEY (id),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);

CREATE TABLE libros_ventas(
    isbn VARCHAR(13) NOT NULL,
    id_venta INT(11) NOT NULL,
    cantidad INT NOT NULL,
    precio_venta FLOAT NOT NULL,

    PRIMARY KEY (isbn, id_venta),
    FOREIGN KEY (isbn) REFERENCES libros(isbn),
    FOREIGN KEY (id_venta) REFERENCES ventas(id)
);

CREATE TABLE liquidaciones(
    id INT(11) NOT NULL AUTO_INCREMENT,

    isbn VARCHAR(13) NOT NULL,
    id_persona INT(11) NOT NULL,
    tipo_persona TINYINT DEFAULT 0 NOT NULL,

    fecha_inicial DATE NOT NULL,
    fecha_final DATE NOT NULL,
    total FLOAT NOT NULL,
    file_path VARCHAR(80) NOT NULL,

    PRIMARY KEY (id, isbn, id_persona, tipo_persona),
    FOREIGN KEY (isbn) REFERENCES libros_ventas(isbn),
    FOREIGN KEY (isbn, id_persona, tipo_persona) REFERENCES libros_personas(isbn, id_persona, tipo)
);

/*Cliente Consumidor final*/
INSERT INTO clientes SET 
nombre = "CONSUMIDOR FINAL",
cond_fiscal = "CONSUMIDOR FINAL",
razon_social = "CONSUMIDOR FINAL",
domicilio = "",
tipo = 0;

/*Cliente En negro*/
INSERT INTO clientes SET 
nombre = "NEGRO",
cond_fiscal = "",
razon_social = "",
domicilio = "",
tipo = 2;