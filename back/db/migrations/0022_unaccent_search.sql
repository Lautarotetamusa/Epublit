-- Búsquedas parciales sin distinguir acentos (ver src/lib/sql/search.ts).
-- Se instala acá para que producción tenga la extensión antes de usar las
-- queries; `IF NOT EXISTS` permite aplicar la migración en bases donde ya
-- esté instalada.
CREATE EXTENSION IF NOT EXISTS unaccent;
