ALTER TABLE libros_consignaciones RENAME COLUMN stock TO cantidad;

ALTER TABLE users ADD COLUMN(
    cuit VARCHAR(15) NOT NULL,
    cond_fiscal VARCHAR(50) NOT NULL,
    razon_social VARCHAR(255) NOT NULL,
    domicilio VARCHAR(100) NOT NULL
);

ALTER TABLE users MODIFY username VARCHAR(25) NOT NULL;
ALTER TABLE users MODIFY password BINARY(60) NOT NULL;