"use strict";

// Prohibe ternarios que ocupan más de `maxLines` líneas: a partir de cierto
// tamaño (branches con objetos/llamadas multilínea) un if/else normal se lee
// más claro que un `? :` con argumentos grandes de cada lado.

const DEFAULT_MAX_LINES = 3;

module.exports = {
    rules: {
        "no-large-ternary": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "Prohibe ternarios (?:) que ocupan más de N líneas; preferir if/else para esos casos."
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            maxLines: { type: "integer", minimum: 1 }
                        },
                        additionalProperties: false
                    }
                ],
                messages: {
                    tooLarge: "Este ternario ocupa {{lines}} líneas (máximo {{max}}). Usá if/else en vez de un ?: tan grande."
                }
            },
            create(context) {
                const maxLines = context.options[0]?.maxLines ?? DEFAULT_MAX_LINES;

                return {
                    ConditionalExpression(node) {
                        const lines = node.loc.end.line - node.loc.start.line + 1;
                        if (lines > maxLines) {
                            context.report({ node, messageId: "tooLarge", data: { lines: String(lines), max: String(maxLines) } });
                        }
                    }
                };
            }
        }
    }
};
