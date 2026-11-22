const { z } = require('zod');

const loginSchema = z.object({
  body: z.object({
    email: z.string({
      message: 'Correo electrónico y contraseña son obligatorios.'
    })
      .trim()
      .email('El formato del correo electrónico no es válido.'),

    password: z.string({
      message: 'Correo electrónico y contraseña son obligatorios.'
    })
      .min(1, 'Correo electrónico y contraseña son obligatorios.')
  })
});

const registerSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'El nombre es obligatorio.' })
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres.'),
      
    email: z.string({ required_error: 'El correo electrónico es obligatorio.' })
      .trim()
      .email('El formato del correo electrónico no es válido.'),

    password: z.string({ required_error: 'La contraseña es obligatoria.' })
      .min(6, 'La contraseña debe tener al menos 6 caracteres.'),
      
    role: z.enum(['odontologo', 'recepcionista'], {
      required_error: 'El rol es obligatorio.',
      invalid_type_error: 'Rol seleccionado no es válido.'
    })
  })
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'El correo electrónico es obligatorio.' })
      .trim()
      .email('El formato del correo electrónico no es válido.')
  })
});

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'El nombre es obligatorio.' })
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres.'),
      
    email: z.string({ required_error: 'El correo electrónico es obligatorio.' })
      .trim()
      .email('El formato del correo electrónico no es válido.'),

    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional().or(z.literal(''))
  })
});

module.exports = {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  updateProfileSchema
};
