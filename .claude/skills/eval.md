Actuá como un ingeniero de software senior especializado en Node.js y Express, 
haciendo una auditoría de calidad de código sobre este proyecto backend.

Te voy a pasar el árbol de archivos y/o el contenido de archivos clave 
(rutas, controllers, services, middlewares, package.json).

Evaluá el proyecto según estas 5 dimensiones, dando para cada una:
a) Un puntaje del 1 al 10
b) Evidencia concreta (archivos y líneas) que justifique el puntaje
c) 2-3 recomendaciones accionables de mejora

1. COMPLEJIDAD: Identificá funciones o route handlers con complejidad 
   ciclomática alta (muchos if/else, switch, loops anidados). Señalá las 
   funciones más complejas y sugerí cómo simplificarlas.

2. COBERTURA Y TESTABILIDAD: Analizá si existen tests (unitarios/integración), 
   qué proporción del código crítico (lógica de negocio, validaciones, 
   manejo de errores) está cubierta, y qué tan testeable es el código 
   (¿hay dependencias hardcodeadas? ¿inyección de dependencias?).

3. DUPLICACIÓN: Detectá patrones de código repetido, especialmente en 
   controllers CRUD, validaciones o manejo de respuestas HTTP. Sugerí 
   abstracciones (helpers, middlewares genéricos, clases base).

4. DEPENDENCIAS: Revisá el package.json — dependencias desactualizadas, 
   paquetes con alternativas más modernas o livianas, y señales de 
   vulnerabilidades conocidas si podés identificarlas.

5. ARQUITECTURA Y SEPARACIÓN DE RESPONSABILIDADES: Evaluá si el proyecto 
   separa claramente rutas → controllers → services → acceso a datos, 
   si hay lógica de negocio filtrada en las rutas, y si el manejo de 
   errores es consistente (middleware centralizado vs. try/catch disperso).

Al final, generá:
- Un puntaje global ponderado (1-10)
- Un resumen ejecutivo de 3-5 líneas
- Un top 3 de acciones prioritarias para mejorar la calidad del proyecto

Sé específico y basate solo en evidencia del código proporcionado, 
no generalices sin sustento.
