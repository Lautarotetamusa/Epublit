"use strict";

// Prohibe `...(await algo())` dentro de un objeto o array literal: obliga a
// nombrar el resultado en una variable antes de spreadearlo, porque
// `{ ...(await x()) }` esconde que hay una espera async en medio de lo que
// parece una construcción sincrónica de un objeto.

module.exports = {
    rules: {
        "no-spread-await": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "Prohibe `...(await algo())` en un objeto/array literal; nombrá el resultado en una variable antes."
                },
                schema: [],
                messages: {
                    spreadAwait: "No hagas spread de un `await` directamente. Asigná el resultado a una variable y spreadeá la variable."
                }
            },
            create(context) {
                return {
                    SpreadElement(node) {
                        if (node.argument.type === "AwaitExpression") {
                            context.report({ node, messageId: "spreadAwait" });
                        }
                    }
                };
            }
        }
    }
};
