alter table users
    add column ingresos_brutos BOOLEAN NOT NULL DEFAULT FALSE,
    add column fecha_inicio CHAR(10) NOT NULL;

update users set 
    ingresos_brutos = true,
    fecha_inicio = "01/01/2021"
where cuit = "27249804024";

update users set 
    ingresos_brutos = false,
    fecha_inicio = "01/10/2021"
where cuit = "20434919798";

update users set 
    ingresos_brutos = false,
    fecha_inicio = "01/11/2013"
where cuit = "30712472053";
