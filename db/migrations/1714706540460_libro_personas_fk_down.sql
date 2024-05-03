ALTER TABLE liquidaciones
    DROP CONSTRAINT liquidaciones_ibfk_2,
    DROP KEY id_libro,
    DROP COLUMN id_libro;

ALTER TABLE libros_personas
    DROP FOREIGN KEY libros_personas_ibfk_2;

ALTER TABLE libros_personas
    DROP PRIMARY KEY,
    DROP COLUMN id_libro,
    ADD PRIMARY KEY (isbn, id_persona, tipo),
    add foreign key (isbn) REFERENCES libros(isbn);

ALTER TABLE liquidaciones
    ADD CONSTRAINT FOREIGN KEY (`isbn`, `id_persona`, `tipo_persona`) REFERENCES `libros_personas` (`isbn`, `id_persona`, `tipo`);
/*
| libros_personas | CREATE TABLE `libros_personas` (
  `isbn` varchar(13) NOT NULL,
  `id_persona` int(11) NOT NULL,
  `porcentaje` float DEFAULT 0,
  `tipo` enum('autor','ilustrador') NOT NULL,
  PRIMARY KEY (`isbn`,`id_persona`,`tipo`),
  KEY `id_persona` (`id_persona`),
  CONSTRAINT `libros_personas_ibfk_1` FOREIGN KEY (`id_persona`) REFERENCES `personas` (`id`),
  CONSTRAINT `libros_personas_ibfk_2` FOREIGN KEY (`isbn`) REFERENCES `libros` (`isbn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci |

    | liquidaciones | CREATE TABLE `liquidaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `isbn` varchar(13) NOT NULL,
  `id_persona` int(11) NOT NULL,
  `fecha_inicial` date NOT NULL,
  `fecha_final` date NOT NULL,
  `total` float NOT NULL,
  `file_path` varchar(80) NOT NULL,
  `tipo_persona` enum('autor','ilustrador') NOT NULL,
  PRIMARY KEY (`id`,`isbn`,`id_persona`,`tipo_persona`),
  KEY `isbn` (`isbn`,`id_persona`,`tipo_persona`),
  CONSTRAINT `liquidaciones_ibfk_1` FOREIGN KEY (`isbn`) REFERENCES `libros_ventas` (`isbn`),
  CONSTRAINT `liquidaciones_ibfk_2` FOREIGN KEY (`isbn`, `id_persona`, `tipo_persona`) REFERENCES `libros_personas` (`isbn`, `id_persona`, `tipo`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci |
*/
