ALTER TABLE clientes MODIFY razon_social VARCHAR(255) NOT NULL;
INSERT INTO clientes SET 
nombre = "CONSUMIDOR FINAL",
cond_fiscal = "CONSUMIDOR FINAL",
razon_social = "CONSUMIDOR FINAL",
domicilio = "",
tipo = 0;