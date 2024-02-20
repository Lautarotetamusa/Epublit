START TRANSACTION;

SELECT constraint_name, 
       constraint_type,
       search_condition
  FROM mysql.USER_CONSTRAINTS
 WHERE table_name = 'TEAMS';


ALTER TABLE liquidaciones
    add column tipo_persona_2 enum ("autor", "ilustrador");
update liquidaciones
    set tipo_persona_2 = CASE 
        WHEN tipo_persona = 0 THEN "autor"
        WHEN tipo_persona = 1 THEN "ilustrador";

ALTER TABLE libros_personas
    add column tipo_persona_2 enum ("autor", "ilustrador");
update libros_personas
    set tipo_persona_2 = CASE 
            WHEN tipo = 0 THEN "autor"
            WHEN tipo = 1 THEN "ilustrador"
        END;

alter table liquidaciones
    drop constraint liquidaciones_ibfk_2,
    drop primary key,
    drop column tipo_persona,
    rename column tipo_persona_2 to tipo_persona,
    add primary key(id, isbn, id_persona, tipo_persona);

alter table libros_personas
    drop primary key,
    drop column tipo,
    rename column tipo_persona_2 to tipo,
    add primary key(isbn, id_persona, tipo);

alter table liquidaciones
    add foreign key (isbn, id_persona, tipo_persona) REFERENCES libros_personas(isbn, id_persona, tipo);
