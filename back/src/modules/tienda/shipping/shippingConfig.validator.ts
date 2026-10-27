import { z } from "zod";

const pesoPromedio = z
    .number()
    .positive()
    .max(100_000)
    .nullable()
    .optional()
    .transform((value) => (value == null ? value : Math.round(value * 1000) / 1000));

const micorreo = z
    .object({
        usuario: z.string().trim().min(1).max(120).optional(),
        password: z.string().min(1).max(500).optional(),
        customerId: z.string().trim().min(1).max(60).optional()
    })
    .strict();

const paqar = z
    .object({
        agreement: z.string().trim().min(1).max(120).optional(),
        apiKey: z.string().min(1).max(500).optional(),
        sellerId: z.string().trim().min(1).max(120).optional()
    })
    .strict();

const origen = z
    .object({
        calle: z.string().trim().min(1).max(120),
        numero: z.string().trim().min(1).max(20),
        piso: z.string().trim().max(20).nullable().optional(),
        depto: z.string().trim().max(20).nullable().optional(),
        localidad: z.string().trim().min(1).max(120),
        provincia: z.string().trim().min(1).max(120),
        codigoPostal: z.string().trim().min(1).max(12)
    })
    .strict();

const cajaDefault = z
    .object({
        altoCm: z.number().positive().max(10_000),
        anchoCm: z.number().positive().max(10_000),
        largoCm: z.number().positive().max(10_000)
    })
    .strict();

const retiro = z
    .object({
        activo: z.boolean(),
        direccion: z.string().trim().max(500).nullable().optional(),
        horario: z.string().trim().max(500).nullable().optional()
    })
    .strict();

const update = z
    .object({
        micorreo: micorreo.optional(),
        paqar: paqar.optional(),
        origen: origen.optional(),
        cajaDefault: cajaDefault.optional(),
        pesoPromedioKg: pesoPromedio,
        formatoEtiqueta: z.literal("10x15").optional(),
        retiro: retiro.optional()
    })
    .strict();

const testConnectionSchema = z.object({ api: z.enum(["micorreo", "paqar"]) }).strict();

export type ShippingConfigUpdate = z.infer<typeof update>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;

export const shippingConfigValidator = { update, testConnection: testConnectionSchema };
