const { z } = require('zod');

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
};

const predictAbsenteeismSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive().optional(),
    appointmentDate: z.string().refine(isValidDate, 'Seleccione una fecha válida.'),
    appointmentTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Seleccione una hora válida.'),
    treatmentId: z.number().int().positive(),
    sex: z.enum(['M', 'F', 'Otro']),
    age: z.number().int().min(1).max(120),
    previousAppointments: z.number().int().min(0).max(500),
    previousAbsences: z.number().int().min(0).max(500),
    previousAttendances: z.number().int().min(0).max(500),
    daysSincePrevious: z.number().int().min(0).max(3650),
    cost: z.number().min(0).max(100000),
  })
});

module.exports = { predictAbsenteeismSchema };
