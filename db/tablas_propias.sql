ALTER TABLE libros
    add column user INT(11) DEFAULT 1,
    add constraint foreign key (user) references users(id);
ALTER TABLE libros
    modify column user INT(11) NOT NULL,
    drop primary key,
    add primary key(isbn, user);

ALTER TABLE ventas
    add column user INT(11) DEFAULT 1,
    add constraint foreign key (user) references users(id);
ALTER TABLE ventas
    modify column user INT(11) NOT NULL;

ALTER TABLE personas
    add column user INT(11) DEFAULT 1,
    add constraint foreign key (user) references users(id);
ALTER TABLE personas
    modify column user INT(11) NOT NULL;

ALTER TABLE clientes
    add column user INT(11) DEFAULT 1,
    add constraint foreign key (user) references users(id);
ALTER TABLE clientes
    modify column user INT(11) NOT NULL;

ALTER TABLE consignaciones
    add column user INT(11) DEFAULT 1,
    add constraint foreign key (user) references users(id);
ALTER TABLE consignaciones
    modify column user INT(11) NOT NULL;

/* No está todavía */
ALTER TABLE liquidaciones
    add column user INT(11) NOT NULL,
    add constraint foreign key (user) references users(id);
