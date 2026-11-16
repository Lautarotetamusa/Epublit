-- Borra una liquidación puntual y revierte sus efectos (plan 012).
--
-- ¿Por qué no alcanza con "delete from liquidaciones"? La liquidación congela
-- sus filas en 4 tablas hijas y, al generarse, suma a `anticipos.recuperado`
-- el importe que descontó de cada anticipo. Si se borra sólo la cabecera, la
-- FK impide el DELETE; si se borra todo sin revertir el anticipo, la persona
-- queda con saldo consumido para siempre.
--
-- El código es único POR CUENTA: si existe la misma LQ en dos cuentas, el
-- bloque 1 aborta y hay que descomentar el filtro por `l.user`.
--
-- La primera vez, cambiar el COMMIT final por ROLLBACK para leer los conteos
-- sin tocar nada.
--
-- OJO: `siguienteCodigo` numera con COUNT(liquidaciones del año) + 1. Borrar
-- la ÚLTIMA del año es seguro; borrar una del medio deja el conteo bajo y la
-- próxima generación choca contra un código existente.

begin;

-- ---------------------------------------------------------------------------
-- 1. Cuál se borra
-- ---------------------------------------------------------------------------
create temp table _target on commit drop as
select l.id, l.user as cuenta, l.codigo, l.desde, l.hasta
from liquidaciones l
where l.codigo = 'LQ-2026-0001'
  -- and l.user = 1
  ;

do $$
declare n int;
begin
    select count(*) into n from _target;
    if n <> 1 then
        raise exception 'Se esperaba 1 liquidación con ese código y hay %. Agregá el filtro por cuenta (l.user) o corregí el código.', n;
    end if;
end $$;

-- Qué se va a borrar, para revisar antes de confirmar.
select t.codigo, t.desde, t.hasta, t.cuenta,
       (select count(*) from liquidacion_personas p where p.liquidacion_id = t.id and p.user = t.cuenta) as personas,
       (select count(*) from liquidacion_lineas ll
          join liquidacion_personas p on p.id = ll.liquidacion_persona_id and p.user = ll.user
         where p.liquidacion_id = t.id and p.user = t.cuenta) as lineas,
       (select count(*) from liquidacion_ventas v where v.liquidacion_id = t.id and v.user = t.cuenta) as ventas,
       (select count(*) from liquidacion_pagos g where g.liquidacion_id = t.id and g.user = t.cuenta and g.anulado = false) as pagos_vigentes,
       (select coalesce(sum(g.monto), 0) from liquidacion_pagos g where g.liquidacion_id = t.id and g.user = t.cuenta and g.anulado = false) as pagado
from _target t;

-- ---------------------------------------------------------------------------
-- 2. Revertir los anticipos que esta liquidación había descontado
--    (mismo agrupamiento con el que se aplicaron: persona + libro + rol)
-- ---------------------------------------------------------------------------
update anticipos a
set recuperado = greatest(0, round((a.recuperado - r.monto)::numeric, 2))
from (
    select p.id_persona, ll.id_libro, ll.id_rol, p.user, sum(ll.anticipo)::numeric as monto
    from liquidacion_lineas ll
    join liquidacion_personas p on p.id = ll.liquidacion_persona_id and p.user = ll.user
    join _target t on t.id = p.liquidacion_id and t.cuenta = p.user
    group by 1, 2, 3, 4
    having sum(ll.anticipo) > 0
) r
where a.id_libro = r.id_libro
  and a.id_persona = r.id_persona
  and a.id_rol = r.id_rol
  and a.user = r.user;

-- ---------------------------------------------------------------------------
-- 3. Borrar las hijas y después la cabecera (orden de las FKs)
-- ---------------------------------------------------------------------------
delete from liquidacion_lineas ll
using liquidacion_personas p, _target t
where p.id = ll.liquidacion_persona_id
  and p.user = ll.user
  and t.id = p.liquidacion_id
  and t.cuenta = p.user;

delete from liquidacion_personas p
using _target t
where t.id = p.liquidacion_id
  and t.cuenta = p.user;

delete from liquidacion_ventas v
using _target t
where t.id = v.liquidacion_id
  and t.cuenta = v.user;

delete from liquidacion_pagos g
using _target t
where t.id = g.liquidacion_id
  and t.cuenta = g.user;

delete from liquidaciones l
using _target t
where t.id = l.id
  and t.cuenta = l.user;

-- Control final: tiene que dar 0.
select (select count(*) from liquidaciones l join _target t on t.id = l.id and t.cuenta = l.user) as quedan;

commit;
