ALTER TABLE precio_libros
    DROP CONSTRAINT precio_libros_ibfk_1,
    DROP COLUMN id_libro;

ALTER TABLE precio_libros
    ADD CONSTRAINT FOREIGN KEY (`isbn`) REFERENCES `libros` (`isbn`);
/*
| precio_libros | CREATE TABLE `precio_libros` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `isbn` varchar(13) NOT NULL,
  `precio` float NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `user` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `isbn` (`isbn`),
  CONSTRAINT `precio_libros_ibfk_1` FOREIGN KEY (`isbn`) REFERENCES `libros` (`isbn`)
) ENGINE=InnoDB AUTO_INCREMENT=181 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci |
*/
