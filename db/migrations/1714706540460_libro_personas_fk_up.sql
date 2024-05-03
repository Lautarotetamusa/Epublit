ALTER TABLE liquidaciones
    DROP CONSTRAINT liquidaciones_ibfk_2,
    ADD COLUMN id_libro INT NOT NULL;

ALTER TABLE libros_personas
    DROP PRIMARY KEY,
    DROP FOREIGN KEY libros_personas_ibfk_2,
    ADD COLUMN id_libro INT NOT NULL;

update libros_personas lp
inner join personas c
    on c.id = lp.id_persona
inner join libros l
    on  l.isbn = lp.isbn 
    and l.user = c.user 
set lp.id_libro = l.id_libro;

ALTER TABLE libros_personas
    ADD FOREIGN KEY (id_libro) REFERENCES libros(id_libro),
    ADD PRIMARY KEY (id_libro, id_persona, tipo);

ALTER TABLE liquidaciones
    ADD FOREIGN KEY (id_libro, id_persona, tipo_persona) REFERENCES libros_personas(id_libro, id_persona, tipo);
