const fs = require('node:fs');

const fileName = __filename.replace('.js','')

const up   = fs.readFileSync(fileName+'_up.sql', 'utf8')
const down = fs.readFileSync(fileName+'_down.sql', 'utf8')

console.log("up:", up);
console.log("down:", down);

module.exports = {
    "up": up,
    "down": down
}
