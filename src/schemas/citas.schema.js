const { z } = require('zod');

// Obtener fecha actual en formato Bolivia (UTC-4)
const getBoliviaTodayStr = () => {
  const date = new Date();
  const boliviaTime = new Date(date.getTime() + (date.getTimezoneOffset() - 240) * 60000);
  const yyyy = boliviaTime.getFullYear();
  const mm = String(boliviaTime.getMonth() + 1).padStart(2, '0');
  const dd = String(boliviaTime.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};


const createAppointmentSchema = z.object({
  body: z.object({
    patient_name: z.string({
      message: 'El nombre del paciente es obligatorio.'
    })
      .trim()
      .min(3, 'El nombre del paciente debe tener al menos 3 caracteres.'),

    patient_phone: z.string()
      .trim()
      .regex(/^\+?[0-9\s\-]{7,15}$/, 'El formato del teléfono no es válido.')
      .optional()
      .nullable(),

    treatment: z.string({
      message: 'El tratamiento es obligatorio.'
    })
      .trim()
      .min(3, 'El tratamiento debe tener al menos 3 caracteres.'),

    appointment_date: z.string({
      message: 'La fecha es obligatoria.'
    })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'El formato de la fecha debe ser YYYY-MM-DD.')
      .refine((dateStr) => {
        const today = getBoliviaTodayStr();
        return dateStr >= today;
      }, {
        message: 'No se pueden programar citas en el pasado.'
      }),

    appointment_time: z.string({
      message: 'La hora es obligatoria.'
    })
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'El formato de la hora debe ser HH:MM.'),

    patient_id: z.number().int().positive().optional().nullable()
  })
});

const patchAppointmentSchema = z.object({
  body: z.object({
    appointment_date: z.string({
      message: 'La fecha es obligatoria para reprogramar.'
    })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'El formato de la fecha debe ser YYYY-MM-DD.')
      .refine((dateStr) => {
        const today = getBoliviaTodayStr();
        return dateStr >= today;
      }, {
        message: 'No se pueden programar citas en el pasado.'
      }),

    appointment_time: z.string({
      message: 'La hora es obligatoria para reprogramar.'
    })
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'El formato de la hora debe ser HH:MM.')
  })
});

module.exports = {
  createAppointmentSchema,
  patchAppointmentSchema
};
