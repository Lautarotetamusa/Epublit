"use strict";

// Detecta funciones cuyo único trabajo es reenviar sus propios parámetros,
// en el mismo orden, a otra llamada — sin agregar lógica (ver CLAUDE.md,
// "Una función, una responsabilidad": no envolver `builder.update()` en un
// `update` que sólo lo reenvía). El caso real que motivó esto: `findAll:
// async (userId, pagination) => repository.findAll(userId, pagination)` en
// vez de `findAll: repository.findAll`.

function getForwardedCall(fn) {
    if (fn.body.type === "BlockStatement") {
        const [statement, ...rest] = fn.body.body;
        if (rest.length > 0 || !statement || statement.type !== "ReturnStatement" || !statement.argument) {
            return null;
        }
        return statement.argument;
    }

    return fn.body;
}

function unwrapAwait(node) {
    return node.type === "AwaitExpression" ? node.argument : node;
}

function paramName(param) {
    // Sólo identificadores simples (incluye `tx?: Tx` con `?` opcional):
    // desestructuración, defaults o rest no cuentan como "mismo parámetro".
    return param.type === "Identifier" ? param.name : null;
}

module.exports = {
    rules: {
        "no-redundant-wrapper": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "Prohibe funciones que sólo reenvían sus parámetros a otra llamada, en el mismo orden, sin lógica propia."
                },
                schema: [],
                messages: {
                    redundant:
                        "Esta función sólo reenvía sus parámetros a '{{callee}}'. Usá '{{callee}}' directamente en vez de envolverla."
                }
            },
            create(context) {
                function check(fn) {
                    const call = unwrapAwait(getForwardedCall(fn) ?? { type: "" });
                    if (!call || call.type !== "CallExpression") return;

                    const params = fn.params.map(paramName);
                    if (params.some((name) => name === null)) return;
                    if (params.length === 0) return;

                    const args = call.arguments.map((arg) => (arg.type === "Identifier" ? arg.name : null));
                    if (args.length !== params.length) return;
                    if (!args.every((name, i) => name === params[i])) return;

                    const callee =
                        call.callee.type === "MemberExpression" && !call.callee.computed
                            ? context.sourceCode.getText(call.callee)
                            : call.callee.type === "Identifier"
                              ? call.callee.name
                              : null;
                    if (!callee) return;

                    context.report({ node: fn, messageId: "redundant", data: { callee } });
                }

                return {
                    ArrowFunctionExpression: check,
                    FunctionExpression: check
                };
            }
        }
    }
};
