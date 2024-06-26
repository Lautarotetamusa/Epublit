alter table users
    add column email varchar(255) default "";

update users
    set email = "info@librosilvestres.com"
    where cuit = "27249804024";
