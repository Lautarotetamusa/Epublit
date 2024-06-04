alter table ventas
    add column type_venta enum ("firme", "consignado") DEFAULT "firme";

alter table ventas
    modify column type_venta enum ("firme", "consignado") NOT NULL;
