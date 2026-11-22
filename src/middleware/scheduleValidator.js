/**
 * ============================================================
 * scheduleValidator.js — Middleware HU-003
 * ============================================================
 * Filtro de jornada laboral. Se ejecuta ANTES del INSERT.
 *
 * Lee dinámicamente la configuración de horarios desde la tabla
 * `settings` de la base de datos, lo que permite modificar los
 * días y ventanas de atención sin tocar el código fuente.
 *
 * Estructura esperada en settings.value (JSON):
 * {
 *   "workDays": [1, 2, 3, 4, 5],          // 0=Dom … 6=Sáb
 *   "timeWindows": [
 *     { "start": "08:00", "end": "12:00" }, // Mañana
 *     { "start": "14:00", "end": "18:00" }  // Tarde
 *   ]
 * }
 * ============================================================
 */

const db = require('../db');

/**
 * Convierte una cadena "HH:MM" a minutos totales desde la medianoche.
 * @param {string} timeStr
 * @returns {number}
 */
function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Middleware Express — Valida que la fecha/hora de la cita esté dentro
 * de al menos una de las ventanas horarias configuradas en la clínica.
 *
 * Si la validación falla → 400 con el mensaje exacto de HU-003.
 * Si pasa → llama a next() para continuar al siguiente middleware.
 */
function validateSchedule(req, res, next) {
  const { appointment_date, appointment_time } = req.body;

  // ── Validación de presencia de campos ──────────────────────────────────
  if (!appointment_date || !appointment_time) {
    return res.status(400).json({
      error: 'La fecha y hora de la cita son obligatorias.'
    });
  }

  // ── Validar formato de fecha ───────────────────────────────────────────
  // Se añade T00:00:00 para evitar desfases de zona horaria al parsear
  const dateObj = new Date(`${appointment_date}T00:00:00`);
  if (isNaN(dateObj.getTime())) {
    return res.status(400).json({
      error: 'La fecha de la cita no es válida.'
    });
  }

  // ── Validar fecha futura (igual o posterior al día de hoy) ──────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObj < today) {
    return res.status(400).json({
      error: 'La fecha de la cita no puede ser anterior al día de hoy.'
    });
  }

  // ── Verificar excepciones/feriados en la base de datos ──────────────────
  const sqlExceptions = "SELECT exception_date, description, is_recurring FROM clinic_exceptions";
  db.all(sqlExceptions, [], (errEx, rows) => {
    if (errEx) {
      console.error('[scheduleValidator] Error al consultar clinic_exceptions:', errEx.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    const targetDateStr = appointment_date;
    const targetMMDD = targetDateStr.substring(5);

    const isHoliday = (rows || []).find(ex => {
      if (ex.is_recurring === 1) {
        return ex.exception_date.substring(5) === targetMMDD;
      }
      return ex.exception_date === targetDateStr;
    });

    if (isHoliday) {
      return res.status(400).json({
        error: `El consultorio se encuentra cerrado por: ${isHoliday.description}`
      });
    }

    const dayOfWeek = dateObj.getDay();

    // ── Cargar configuración desde la tabla working_hours ──────────────────
    const sql = "SELECT activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin FROM working_hours WHERE day_of_week = ?";
    db.get(sql, [dayOfWeek], (err, row) => {
      if (err) {
        console.error('[scheduleValidator] Error al consultar working_hours:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
      }

      // Si el día está desactivado, está fuera del horario de atención
      if (!row || !row.activo) {
        return res.status(400).json({
          error: 'La cita se encuentra fuera del horario de atención'
        });
      }

      // ── Validar formato de hora ────────────────────────────────────────────
      const timeParts = appointment_time.split(':').map(Number);
      if (
        timeParts.length !== 2 ||
        isNaN(timeParts[0]) || isNaN(timeParts[1]) ||
        timeParts[0] < 0 || timeParts[0] > 23 ||
        timeParts[1] < 0 || timeParts[1] > 59
      ) {
        return res.status(400).json({
          error: 'La cita se encuentra fuera del horario de atención'
        });
      }

      const inputMinutes = toMinutes(appointment_time);

      // ── Validar contra las ventanas de mañana y tarde configuradas ─────────
      let isWithinAWindow = false;

      // Ventana de la mañana
      if (row.mañana_inicio && row.mañana_fin) {
        const windowStart = toMinutes(row.mañana_inicio);
        const windowEnd   = toMinutes(row.mañana_fin);
        if (inputMinutes >= windowStart && inputMinutes <= windowEnd) {
          isWithinAWindow = true;
        }
      }

      // Ventana de la tarde
      if (row.tarde_inicio && row.tarde_fin) {
        const windowStart = toMinutes(row.tarde_inicio);
        const windowEnd   = toMinutes(row.tarde_fin);
        if (inputMinutes >= windowStart && inputMinutes <= windowEnd) {
          isWithinAWindow = true;
        }
      }

      if (!isWithinAWindow) {
        return res.status(400).json({
          error: 'La cita se encuentra fuera del horario de atención'
        });
      }

      // ── Todas las validaciones de jornada pasaron → continuar pipeline ─────
      next();
    });
  });
}


module.exports = { validateSchedule };
