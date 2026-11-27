-- Promueve una cuenta existente a administrador del panel /admin.
--
-- Requisito: la migración 0029 ya aplicada (columna users.role).
-- La cuenta debe existir; si es nueva, primero registrala y confirmá el email.
--
-- Uso:
--   psql "$DATABASE_URL" \
--     -v admin_identificador='usuario@ejemplo.com' \
--     -f scripts/promover-admin.sql
--
-- El identificador puede ser username, email o CUIT. Para username/email la
-- comparación no distingue mayúsculas. Si el UPDATE devuelve 0 filas, el
-- identificador no existe: no se creó ninguna cuenta.
--
-- El acceso al panel sólo mira el rol. Si además querés que la cuenta aparezca
-- en las métricas, tiene que tener email_confirmado = true (el panel sólo
-- cuenta cuentas habilitadas). La verificación final lo muestra.

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        RAISE EXCEPTION 'Falta la migración 0029: users.role no existe';
    END IF;
END $$;

UPDATE users
SET role = 'admin'
WHERE lower(email) = lower(:'admin_identificador')
   OR lower(username) = lower(:'admin_identificador')
   OR cuit = :'admin_identificador'
RETURNING id, username, email, cuit, email_confirmado, role;

-- Verificación: la cuenta debe quedar con role = admin.
-- Si email_confirmado = false y querés que cuente en las métricas, confirmala
-- desde la aplicación (o con un UPDATE explícito y consciente).
SELECT id, username, email, cuit, email_confirmado, role
FROM users
WHERE lower(email) = lower(:'admin_identificador')
   OR lower(username) = lower(:'admin_identificador')
   OR cuit = :'admin_identificador';

COMMIT;
