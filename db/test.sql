select * from libros_personas where id_persona=707;
/*
+---------------+------------+------+------------+
| isbn          | id_persona | tipo | porcentaje |
+---------------+------------+------+------------+
| 9789874704115 |        707 |    0 |          0 |
| 9789874704115 |        707 |    1 |          0 |
| 9789874765130 |        707 |    1 |          0 |
+---------------+------------+------+------------+
*/

/*Insertado correctamente*/
insert into liquidacion_persona set 
    isbn=9789874704115, 
    id_persona=707, 
    tipo_persona=0;

/*Duplicated Entry*/
insert into liquidacion_persona set 
    isbn=9789874704115, 
    id_persona=707, 
    tipo_persona=0;

/*Foreign Key constraint*/
insert into liquidacion_persona set 
    isbn=9789000000000, 
    id_persona=707, 
    tipo_persona=0;

