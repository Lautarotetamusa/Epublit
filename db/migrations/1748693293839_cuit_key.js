const up = `
ALTER TABLE users
ADD CONSTRAINT cuit_unique UNIQUE (cuit);
`;

const down = `
ALTER TABLE users
DROP INDEX cuit_unique;
`;

module.exports = {
    "up": up,
    "down": down
};
