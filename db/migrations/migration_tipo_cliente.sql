START TRANSACTION;

ALTER TABLE clientes
    add column tipo_clientes_2 enum ("inscripto", "particular", "negro");

update clientes
    set tipo_clientes_2 = CASE 
            WHEN tipo = 0 THEN "particular"
            WHEN tipo = 1 THEN "inscripto"
            WHEN tipo = 2 THEN "negro"
        END;

alter table clientes
    drop column tipo,
    rename column tipo_clientes_2 to tipo,
