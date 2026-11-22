const { z } = require('zod');

const createPatientSchema = z.object({
  body: z.object({
    nombre_completo: z.string({
      message: 'El nombre completo es obligatorio.'
    })
      .trim()
      .min(3, 'El nombre completo debe tener al menos 3 caracteres.'),

    telefono: z.string()
      .trim()
      .regex(/^\+?[0-9\s\-]{7,15}$/, 'El formato del teléfono no es válido.')
      .optional()
      .nullable(),

    ci: z.string({
      message: 'La Cédula de Identidad (CI) es obligatoria.'
    })
      .trim()
      .min(3, 'La Cédula de Identidad (CI) debe tener al menos 3 caracteres.'),

    notas_medicas: z.string().trim().optional().nullable()
  })
});

module.exports = {
  createPatientSchema
};
