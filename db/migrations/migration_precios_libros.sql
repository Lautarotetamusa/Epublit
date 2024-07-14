CREATE TABLE precio_libros(
    id INT NOT NULL AUTO_INCREMENT,
    isbn VARCHAR(13) NOT NULL,
    precio FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    FOREIGN KEY (isbn) REFERENCES libros(isbn)
);

INSERT INTO precio_libros (precio, isbn) SELECT precio, isbn FROM libros;
