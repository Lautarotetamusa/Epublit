INSERT INTO libros (isbn, titulo, precio, stock, user, fecha_edicion)
VALUES 
    ("9789874888365", "Aportes para la historia de Rojas", 19000, 0, 4, CURDATE()), 
    ("9789874708427", "Camino Vivencias de un ACV", 9000, 0, 4, CURDATE()), 
    ("9789874708441", "Canto de tiera y de pan", 6500, 0, 4, CURDATE()), 
    ("9789874888327", "Casos abiertos", 10000, 0, 4, CURDATE()), 
    ("9789874813206", "Cuentos que no son cuentos…", 0, 0, 4, CURDATE()), 
    ("9789874708489", "De la tierra", 12000, 0, 4, CURDATE()), 
    ("9789874888303", "De los municipios a la unidad…", 16000, 0, 4, CURDATE()), 
    ("9789874299239", "Donde el sol confluye con la mierda", 6500, 0, 4, CURDATE()), 
    ("9789874294388", "El vértigo de la felicidad", 9000, 0, 4, CURDATE()), 
    ("9786319039405", "Ellas bailan con todos", 10000, 0, 4, CURDATE()), 
    ("9789874813299", "Entre ratas y golondrinas", 9000, 0, 4, CURDATE()), 
    ("9789874813213", "Filosofía profana", 11000, 0, 4, CURDATE()), 
    ("9789874813275", "Int A la teoría feminista", 13.000, 0, 4, CURDATE()), 
    ("9786319039412", "La fantasía neoliberal", 15000, 0, 4, CURDATE()), 
    ("9789874708434", "La llave maestra", 8000, 0, 4, CURDATE()), 
    ("9789874708410", "La salida", 9000, 0, 4, CURDATE()), 
    ("9789874888341", "Las máquinas psíquicas", 12000, 0, 4, CURDATE()), 
    ("9789874274724", "Literales ausencias", 6500, 0, 4, CURDATE()), 
    ("9789874813268", "Los vestigios de la greda", 7500, 0, 4, CURDATE()), 
    ("9789874888334", "Me hace ilusión", 10000, 0, 4, CURDATE()), 
    ("9789874888396", "Memorias de Alberto Perassolo", 8000, 0, 4, CURDATE()), 
    ("9789874708465", "Mil veces la vida", 11000, 0, 4, CURDATE()), 
    ("9789874708403", "Políticas del discurso", 11000, 0, 4, CURDATE()), 
    ("9789874913220", "Pueblos y parajes de Rojas", 16000, 0, 4, CURDATE()), 
    ("9789874708496", "Razón maldita", 6500, 0, 4, CURDATE()), 
    ("9789874708472", "Sakuntala", 8000, 0, 4, CURDATE()), 
    ("9789874813244", "SIVELA", 8500, 0, 4, CURDATE()), 
    ("9789874813237", "Un año encerrado", 7000, 0, 4, CURDATE()), 
    ("9789874708458", "Un desmayo en el vacío", 9500, 0, 4, CURDATE())

autores
insert into personas (nombre, dni, user)
values 
	("Hugo Silveira", 11111111, 4),
	("Araceli Rodríguez", 11111112, 4),
	("Rolando Galante", 11111113, 4),
	("Hernán Carbonel", 11111114, 4),
	("María Elena Jué", 11111115, 4),
	("Juan José Oppizzi", 11111116, 4),
	("Juan Jorge Barbero", 11111117, 4),
	("Paul Bravo", 11111118, 4),
	("Amir Abdala", 11111119, 4),
	("Marcela Garavano", 11111110, 4),
	("Amir Abdala", 11111121, 4),
	("Silvana Vignale", 11111122, 4),
	("Danila Suárez Tomé", 11111123, 4),
	("Carlos Gracian", 11111124, 4),
	("Araceli Rodríguez", 11111125, 4),
	("Juan José Oppizzi", 11111126, 4),
	("Emiliano Exposto", 11111127, 4),
	("Juan Carlos Llauradó", 11111128, 4),
	("Rolando Galante", 11111129, 4),
	("Leandro Gabilondo", 11111120, 4),
	("Elcoro-Barzaghi", 11111131, 4),
	("María Elena Sofía", 11111132, 4),
	("Diego Singer", 11111133, 4),
	("Hugo Silveira", 11111134, 4),
	("Marcelo Baleriani", 11111135, 4),
	("Alejandro Elcoro", 11111136, 4),
	("Mercedes Aguirre", 11111137, 4),
	("Paul Bravo", 11111138, 4),
	("Federico Riveiro", 11111139, 4);

select * from personas where user=4;
insert into libros_personas (isbn, id_persona, tipo, id_libro)
values
    ()
1067
1068
1069
1070
1071
1072
1073
1074
1075
1076
1077
1078
1079
1080
1081
1082
1083
1084
1085
1086
1087
1088
1089
1090
1091
1092
1093
1094
1095

insert into libros_personas (isbn, id_persona, id_libro, tipo)
values
 	("9789874888365", 1067, 187, "autor"), 
 	("9789874708427", 1068, 188, "autor"), 
 	("9789874708441", 1069, 189, "autor"), 
 	("9789874888327", 1070, 190, "autor"), 
 	("9789874813206", 1071, 191, "autor"), 
 	("9789874708489", 1072, 192, "autor"), 
 	("9789874888303", 1073, 193, "autor"), 
 	("9789874299239", 1074, 194, "autor"), 
 	("9789874294388", 1075, 195, "autor"), 
 	("9786319039405", 1076, 196, "autor"), 
 	("9789874813299", 1077, 197, "autor"), 
 	("9789874813213", 1078, 198, "autor"), 
 	("9789874813275", 1079, 199, "autor"), 
 	("9786319039412", 1080, 200, "autor"), 
 	("9789874708434", 1081, 201, "autor"), 
 	("9789874708410", 1082, 202, "autor"), 
 	("9789874888341", 1083, 203, "autor"), 
 	("9789874274724", 1084, 204, "autor"), 
 	("9789874813268", 1085, 205, "autor"), 
 	("9789874888334", 1086, 206, "autor"), 
 	("9789874888396", 1087, 207, "autor"), 
 	("9789874708465", 1088, 208, "autor"), 
 	("9789874708403", 1089, 209, "autor"), 
 	("9789874913220", 1090, 210, "autor"), 
 	("9789874708496", 1091, 211, "autor"), 
 	("9789874708472", 1092, 212, "autor"), 
 	("9789874813244", 1093, 213, "autor"), 
 	("9789874813237", 1094, 214, "autor"), 
 	("9789874708458", 1095, 215, "autor"); 

Título	Autor	ISBN	$
Aportes para la historia de Rojas	Hugo Silveira	9789874888365	 $  19.000,00 
Camino. Vivencias de un ACV	Araceli Rodríguez	9789874708427	 $  9.000,00 
Canto de tiera y de pan	Rolando Galante	9789874708441	 $  6.500,00 
Casos abiertos	Hernán Carbonel	9789874888327	 $  10.000,00 
Cuentos que no son cuentos…	María Elena Jué	9789874813206	 Sin stock 
De la tierra	Juan José Oppizzi	9789874708489	 $  12.000 
De los municipios a la unidad…	Juan Jorge Barbero	9789874888303	 $  16.000 
Donde el sol confluye con la mierda	Paul Bravo	9789874299239	 $  6.500 
El vértigo de la felicidad	Amir Abdala	9789874294388	 $  9.000 
Ellas bailan con todos	Marcela Garavano	9786319039405	 $  10.000 
Entre ratas y golondrinas	Amir Abdala	9789874813299	 $  9.000 
Filosofía profana	Silvana Vignale	9789874813213	 $  11.000 
Int. A la teoría feminista	Danila Suárez Tomé	9789874813275	 $  13.000 
La fantasía neoliberal	Carlos Gracian	9786319039412	 $  15.000 
La llave maestra	Araceli Rodríguez	9789874708434	 $  8.000 
La salida	Juan José Oppizzi	9789874708410	 $  9.000 
Las máquinas psíquicas	Emiliano Exposto	9789874888341	 $  12.000 
Literales ausencias	Juan Carlos Llauradó	9789874274724	 $  6.500 
Los vestigios de la greda	Rolando Galante	9789874813268	 $  7.500 
Me hace ilusión	Leandro Gabilondo	9789874888334	 $  10.000 
Memorias de Alberto Perassolo	Elcoro-Barzaghi	9789874888396	 $  8.000 
Mil veces la vida	María Elena Sofía	9789874708465	 $  11.000 
Políticas del discurso	Diego Singer	9789874708403	 $  11.000 
Pueblos y parajes de Rojas	Hugo Silveira	9789874913220	 $  16.000 
Razón maldita	Marcelo Baleriani	9789874708496	 $  6.500 
Sakuntala	Alejandro Elcoro	9789874708472	 $  8.000 
SIVELA	Mercedes Aguirre	9789874813244	 $  8.500 
Un año encerrado	Paul Bravo	9789874813237	 $  7.000 
Un desmayo en el vacío	Federico Riveiro	9789874708458	 $  9.500 
