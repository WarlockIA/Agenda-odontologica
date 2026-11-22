const { z } = require('zod');

const createTreatmentSchema = z.object({
  body: z.object({
    nombre: z.string({
      required_error: 'El nombre del tratamiento es obligatorio.',
      invalid_type_error: 'El nombre del tratamiento debe ser texto.'
    })
      .trim()
      .min(3, 'El nombre del tratamiento debe tener al menos 3 caracteres.'),

    costo_base: z.number({
      required_error: 'El costo base es obligatorio.',
      invalid_type_error: 'El costo base debe ser un número.'
    })
      .positive('El costo base debe ser un número positivo.'),

    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe tener formato hexadecimal válido (ej. #FFFFFF)').optional(),
    
    categoria: z.string().trim().min(2, 'La categoría debe tener al menos 2 caracteres.').optional()
  })
});

const updateTreatmentSchema = z.object({
  body: z.object({
    nombre: z.string({
      required_error: 'El nombre del tratamiento es obligatorio.',
      invalid_type_error: 'El nombre del tratamiento debe ser texto.'
    })
      .trim()
      .min(3, 'El nombre del tratamiento debe tener al menos 3 caracteres.'),

    costo_base: z.number({
      required_error: 'El costo base es obligatorio.',
      invalid_type_error: 'El costo base debe ser un número.'
    })
      .positive('El costo base debe ser un número positivo.'),

    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe tener formato hexadecimal válido (ej. #FFFFFF)').optional(),

    categoria: z.string().trim().min(2, 'La categoría debe tener al menos 2 caracteres.').optional(),

    activo: z.union([z.number(), z.boolean()]).optional()
  })
});

module.exports = {
  createTreatmentSchema,
  updateTreatmentSchema
};
