# Mails transaccionales (Postmark)

Los templates viven en Postmark y se versionan acá con `postmark-cli`. El back
nunca arma HTML: manda el alias del template y el modelo
(`src/lib/email/email.service.ts`).

- `templates/<alias>/`: `content.html`, `content.txt` y `meta.json` (alias,
  asunto, layout y modelo de prueba para el preview de Postmark).
- `templates/_layouts/<alias>/`: layouts compartidos (`{{{ @content }}}`).

## Flujo

1. Editar el template acá (o en Postmark y traerlo con `npm run emails:pull`).
2. Si usa una variable nueva, agregarla al modelo del método que lo envía:
   `test/email.test.ts` falla si el template pide algo que el back no manda.
3. Publicar con `npm run emails:push`.

Los scripts leen `POSTMARK_SERVER_TOKEN` del entorno.

## Sin Postmark configurado

Si `POSTMARK_SERVER_TOKEN` está vacío, los mails no se envían: quedan en el
log del back (`[email] sin POSTMARK_SERVER_TOKEN`). En producción, al cargar el
token también hacen falta `EMAIL_FROM` (remitente verificado) y `PANEL_URL`
(https, base de los links).
