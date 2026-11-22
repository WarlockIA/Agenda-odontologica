const CitasRepository = require('../repositories/CitasRepository');
const TratamientosRepository = require('../repositories/TratamientosRepository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * GET /api/appointments
 * Retorna las citas por rango de fecha (semana) o para un día específico.
 */
const getAppointments = catchAsync(async (req, res, next) => {
  let selectedDate = req.query.date;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  if (startDate && endDate) {
    const appointments = await CitasRepository.findInRange(startDate, endDate);
    return res.status(200).json({ appointments });
  }

  if (!selectedDate) {
    const localDate = new Date();
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    selectedDate = `${yyyy}-${mm}-${dd}`;
  }

  const appointments = await CitasRepository.findByDate(selectedDate);
  res.status(200).json({ appointments });
});

/**
 * POST /api/appointments
 * Registra una nueva cita.
 */
const createAppointment = catchAsync(async (req, res, next) => {
  const { patient_name, patient_phone, treatment, appointment_date, appointment_time, patient_id } = req.body;
  const created_by = req.user.id;

  if (!patient_name || !treatment) {
    throw new AppError('El nombre del paciente y el tratamiento son obligatorios.', 400);
  }

  const appointment = await CitasRepository.create({
    patient_name,
    patient_phone,
    treatment,
    appointment_date,
    appointment_time,
    created_by,
    patient_id
  });
  
  res.status(201).json({
    message: 'Cita registrada con éxito.',
    appointment
  });
});

/**
 * PUT /api/appointments/:id
 * Modifica todos los datos de una cita existente.
 */
const updateAppointment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { patient_name, patient_phone, treatment, appointment_date, appointment_time, patient_id } = req.body;

  if (!patient_name || !treatment) {
    throw new AppError('El nombre del paciente y el tratamiento son obligatorios.', 400);
  }

  await CitasRepository.update(id, {
    patient_name,
    patient_phone,
    treatment,
    appointment_date,
    appointment_time,
    patient_id
  });

  res.status(200).json({
    message: 'Cita modificada con éxito.',
    appointment: {
      id: parseInt(id),
      patient_name,
      patient_phone: patient_phone || null,
      treatment,
      appointment_date,
      appointment_time,
      patient_id: patient_id || null
    }
  });
});

/**
 * PATCH /api/appointments/:id
 * Reprogramación parcial de cita (fecha y hora).
 */
const patchAppointment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { appointment_date, appointment_time } = req.body;

  if (!appointment_date || !appointment_time) {
    throw new AppError('La fecha y hora de la cita son obligatorias para reprogramar.', 400);
  }

  const appt = await CitasRepository.findById(id);
  if (!appt) {
    throw new AppError('La cita especificada no existe.', 404);
  }

  await CitasRepository.patch(id, appointment_date, appointment_time);

  res.status(200).json({
    message: 'Cita reprogramada con éxito.',
    appointment: {
      id: parseInt(id),
      patient_name: appt.patient_name,
      patient_phone: appt.patient_phone,
      treatment: appt.treatment,
      appointment_date,
      appointment_time,
      status: appt.status,
      patient_id: appt.patient_id
    }
  });
});

/**
 * PATCH /api/appointments/:id/status
 * Actualiza el estado básico de una cita.
 */
const updateAppointmentStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['Programada', 'En Espera', 'Atendida', 'Ausente', 'Cancelada'];
  if (!status || !validStatuses.includes(status)) {
    throw new AppError('Estado de cita no válido.', 400);
  }

  const result = await CitasRepository.updateStatus(id, status);
  if (result.changes === 0) {
    throw new AppError('La cita especificada no existe.', 404);
  }
  
  const habilitarModuloClinico = status === 'Atendida';
  res.status(200).json({
    message: 'Estado de cita actualizado con éxito.',
    appointment: { id: parseInt(id), status },
    habilitarModuloClinico
  });
});

/**
 * PATCH /api/citas/:id/estado
 * Endpoint rápido de jornada con validación de whitelist y campos extraños.
 */
const updateCitaEstadoRapido = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const bodyKeys = Object.keys(req.body);
  const forbiddenFields = bodyKeys.filter(key => key !== 'estado');
  if (forbiddenFields.length > 0) {
    throw new AppError(`Petición no válida. Se detectaron campos no permitidos: ${forbiddenFields.join(', ')}. Solo se permite modificar el campo 'estado'.`, 400);
  }

  const { estado } = req.body;
  const validStatuses = ['Programada', 'En Espera', 'Atendida', 'Ausente'];
  if (!estado || !validStatuses.includes(estado)) {
    throw new AppError('Estado de cita no válido o ausente.', 400);
  }

  const result = await CitasRepository.updateStatus(id, estado);
  if (result.changes === 0) {
    throw new AppError('La cita especificada no existe.', 404);
  }
  
  const habilitarModuloClinico = estado === 'Atendida';
  res.status(200).json({
    success: true,
    id: parseInt(id),
    estado: estado,
    habilitarModuloClinico
  });
});

/**
 * PATCH /api/appointments/:id/cancel
 * Cancela una cita (Soft Delete).
 */
const cancelAppointment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  await CitasRepository.cancel(id);
  
  res.status(200).json({
    message: 'Cita cancelada con éxito.',
    appointment: { id: parseInt(id), status: 'Cancelada' }
  });
});

/**
 * POST /api/citas/:id/historial
 * Registra o actualiza el historial clínico (observaciones y tratamientos aplicados) de una cita.
 * Requiere que el estado sea estrictamente 'Atendida'.
 */
const saveClinicalHistory = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { observaciones, tratamiento_ids } = req.body;

  const appt = await CitasRepository.findById(id);
  if (!appt) {
    throw new AppError('La cita especificada no existe.', 404);
  }

  // Validación crítica de flujo (Escenario 1)
  if (appt.status !== 'Atendida') {
    throw new AppError('No se puede registrar historial clínico en una cita que no haya sido completada y marcada como Atendida', 400);
  }

  // Resolver costo de cada tratamiento del catálogo para blindar histórico de cobros
  const list = [];
  if (tratamiento_ids && tratamiento_ids.length > 0) {
    for (const tId of tratamiento_ids) {
      const treatment = await TratamientosRepository.findById(tId);
      if (!treatment) {
        throw new AppError(`El tratamiento con ID ${tId} no existe en el catálogo.`, 400);
      }
      list.push({ id: treatment.id, costo: treatment.costo_base });
    }
  }

  await CitasRepository.saveHistory(id, observaciones, list);

  res.status(200).json({
    success: true,
    message: 'Historial clínico guardado con éxito.'
  });
});

/**
 * GET /api/citas/:id/historial
 * Recupera el historial clínico registrado para una cita.
 */
const getClinicalHistory = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const appt = await CitasRepository.findById(id);
  if (!appt) {
    throw new AppError('La cita especificada no existe.', 404);
  }

  const history = await CitasRepository.getHistory(id);

  res.status(200).json({
    success: true,
    history
  });
});

module.exports = {
  getAppointments,
  createAppointment,
  updateAppointment,
  patchAppointment,
  updateAppointmentStatus,
  updateCitaEstadoRapido,
  cancelAppointment,
  saveClinicalHistory,
  getClinicalHistory
};
