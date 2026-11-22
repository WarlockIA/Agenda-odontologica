/**
 * ============================================================
 * checkPastAppointment.js — Middleware HU-006
 * ============================================================
 * Bloquea la edición o cancelación de citas que ya sucedieron.
 *
 * Busca la cita mediante CitasRepository. Si no existe, retorna 404.
 * Si existe, compara la fecha y hora de la cita con el momento actual.
 * Si pertenece al pasado, retorna HTTP 400 Bad Request.
 * De lo contrario, almacena la cita en req.existingAppointment y continúa.
 * ============================================================
 */

const CitasRepository = require('../repositories/CitasRepository');

function checkPastAppointment(req, res, next) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'El ID de la cita es obligatorio.' });
  }

  CitasRepository.findById(id)
    .then(appt => {
      if (!appt) {
        return res.status(404).json({ error: 'La cita especificada no existe.' });
      }

      // Comparar fecha y hora exacta de la cita con el momento actual
      const timeStr = appt.appointment_time || '00:00';
      const apptDateTime = new Date(`${appt.appointment_date}T${timeStr}:00`);
      const now = new Date();

      if (apptDateTime < now) {
        return res.status(400).json({
          error: 'No se pueden modificar ni cancelar citas pasadas.'
        });
      }

      // Almacenar los datos de la cita existente en la request
      req.existingAppointment = appt;
      next();
    })
    .catch(err => {
      console.error('[checkPastAppointment] Error al consultar cita:', err.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    });
}

module.exports = { checkPastAppointment };
