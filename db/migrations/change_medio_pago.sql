alter table ventas
    add column medio_pago_2 enum ("efectivo", "debito", "credito", "mercadopago", "transferencia");

update ventas
    set medio_pago_2 = CASE
        when medio_pago = 0 then "efectivo"
        when medio_pago = 1 then "debito"
        when medio_pago = 2 then "credito"
        when medio_pago = 3 then "mercadopago"
        when medio_pago = 4 then "transferencia"
    END;

alter table ventas
    drop column medio_pago,
    rename column medio_pago_2 to medio_pago;

