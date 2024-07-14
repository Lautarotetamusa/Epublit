alter table ventas
    add column tipo_cbte INT DEFAULT 11;
alter table ventas
    modify column tipo_cbte INT NOT NULL;

