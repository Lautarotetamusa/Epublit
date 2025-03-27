DELIMITER $$

CREATE TRIGGER crear_clientes_por_usuario
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    -- Insertar cliente MOSTRADOR (tipo negro)
    INSERT INTO clientes (user, tipo, nombre, cond_fiscal, razon_social, domicilio)
    VALUES (NEW.id, 'negro', 'MOSTRADOR', '', '', '');
    
    -- Insertar cliente CONSUMIDOR FINAL (tipo particular)
    INSERT INTO clientes (user, tipo, nombre, cond_fiscal, razon_social, domicilio)
    VALUES (NEW.id, 'particular', 'CONSUMIDOR FINAL', 'CONSUMIDOR FINAL', 'CONSUMIDOR FINAL', '');
END$$

DELIMITER ;
