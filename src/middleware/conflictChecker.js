/**
 * ============================================================
 * conflictChecker.js — Middleware HU-001
 * ============================================================
 * Detector de cruce de horarios. Se ejecuta ANTES del INSERT.
 *
 * Consulta a través de CitasRepository para verificar si ya existe
 * otra cita programada en la misma fecha y hora cuya estado no sea 'Cancelada'.
 *
 * Si existe un conflicto, aborta la operación retornando HTTP 409 Conflict.
 * Si no hay conflicto, llama a next() para continuar al siguiente paso.
 * ============================================================
 */

const CitasRepository = require('../repositories/CitasRepository');

/**
 * Middleware Express — Valida la inexistencia de cruces de citas.
 */
function checkAppointmentConflict(req, res, next) {
  const { appointment_date, appointment_time } = req.body;
  const { id } = req.params; // ID de la cita que se está editando (si aplica)

  // Validación de presencia
  if (!appointment_date || !appointment_time) {
    return res.status(400).json({
      error: 'La fecha y hora de la cita son obligatorias.'
    });
  }

  CitasRepository.checkConflict(appointment_date, appointment_time, id)
    .then(row => {
      // Si se encuentra una cita existente, bloquear con un 409 Conflict
      if (row) {
        return res.status(409).json({
          error: 'Ya existe una cita registrada en esa fecha y hora.'
        });
      }
      // Si no hay conflictos, continuar
      next();
    })
    .catch(err => {
      console.error('[conflictChecker] Error al consultar conflicto:', err.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    });
}

module.exports = { checkAppointmentConflict };
