window.EpublitData = (function(){
  const libros = [
    { id:1, titulo:'La ciudad ausente', autor:'Ricardo Piglia', sello:'Sur Editora', isbn:'9789871234567', pvp:18500, stock:412, estado:'ok', ecom:true },
    { id:2, titulo:'Cuentos del sur', autor:'María Beltrán', sello:'Sur Editora', isbn:'9789874455120', pvp:14200, stock:38, estado:'bajo', ecom:true },
    { id:3, titulo:'Tratado del papel', autor:'J. Ferreyra', sello:'Cuenco Azul', isbn:'9789870099887', pvp:22900, stock:0, estado:'sin', ecom:false },
    { id:4, titulo:'Las horas largas', autor:'Elena Sosa', sello:'Prensa Menor', isbn:'9789871199003', pvp:16750, stock:126, estado:'ok', ecom:true },
    { id:5, titulo:'Manual de imprenta', autor:'Carlos Vidal', sello:'Cuenco Azul', isbn:'9789875540012', pvp:31000, stock:74, estado:'ok', ecom:false },
    { id:6, titulo:'Cartografía menor', autor:'Ana Duarte', sello:'Prensa Menor', isbn:'9789878820451', pvp:19800, stock:9, estado:'bajo', ecom:true },
  ];
  const liquidaciones = [
    { id:'L-0184', pdv:'Librería Norte', periodo:'Julio 2026', ejemplares:64, bruto:912400, comision:35, neto:593060, estado:'liquidado' },
    { id:'L-0183', pdv:'El Ateneo Central', periodo:'Julio 2026', ejemplares:118, bruto:1740500, comision:40, neto:1044300, estado:'pendiente' },
    { id:'L-0182', pdv:'Distribuidora Sur', periodo:'Junio 2026', ejemplares:212, bruto:2984000, comision:45, neto:1641200, estado:'liquidado' },
    { id:'L-0181', pdv:'Librería Norte', periodo:'Junio 2026', ejemplares:57, bruto:806300, comision:35, neto:524095, estado:'liquidado' },
    { id:'L-0180', pdv:'Feria del Libro', periodo:'Mayo 2026', ejemplares:340, bruto:4612000, comision:30, neto:3228400, estado:'revision' },
  ];
  const movimientos = [
    { fecha:'12/08/2026', tipo:'Salida', detalle:'Remito 1042 · El Ateneo Central', cant:-24, saldo:412 },
    { fecha:'09/08/2026', tipo:'Entrada', detalle:'Ingreso de imprenta · Lote 7', cant:120, saldo:436 },
    { fecha:'02/08/2026', tipo:'Salida', detalle:'Remito 1039 · Librería Norte', cant:-18, saldo:316 },
    { fecha:'28/07/2026', tipo:'Ajuste', detalle:'Recuento de depósito', cant:-3, saldo:334 },
  ];
  const money = n => '$ ' + n.toLocaleString('es-AR');
  return { libros, liquidaciones, movimientos, money };
})();
