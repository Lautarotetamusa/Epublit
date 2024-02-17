ALTER TABLE libros_personas
    MODIFY COLUMN tipo ENUM("autor", "ilustrador") NOT NULL;
