const db = require('../db');

class CitasRepository {
  /**
   * Obtiene las citas programadas en un rango de fechas.
   * @param {string} startDate
   * @param {string} endDate
   * @returns {Promise<Array>}
   */
  static findInRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT a.id, a.patient_name, a.patient_phone, a.treatment, a.appointment_date, a.appointment_time, a.status, a.patient_id,
               u.name AS created_by_name
        FROM appointments a
        JOIN users u ON a.created_by = u.id
        WHERE a.appointment_date >= ? AND a.appointment_date <= ? AND a.status != 'Cancelada'
        ORDER BY a.appointment_date ASC, a.appointment_time ASC
      `;
      db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Obtiene las citas programadas para un día específico.
   * @param {string} date
   * @returns {Promise<Array>}
   */
  static findByDate(date) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT a.id, a.patient_name, a.patient_phone, a.treatment, a.appointment_date, a.appointment_time, a.status, a.patient_id,
               u.name AS created_by_name
        FROM appointments a
        JOIN users u ON a.created_by = u.id
        WHERE a.appointment_date = ? AND a.status != 'Cancelada'
        ORDER BY a.appointment_time ASC
      `;
      db.all(sql, [date], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Busca una cita específica por su ID.
   * @param {number|string} id
   * @returns {Promise<object|null>}
   */
  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, patient_name, patient_phone, treatment, appointment_date, appointment_time, status, patient_id FROM appointments WHERE id = ?';
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Registra una nueva cita.
   * @param {object} data
   * @returns {Promise<object>}
   */
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO appointments (patient_name, patient_phone, treatment, appointment_date, appointment_time, created_by, status, patient_id)
        VALUES (?, ?, ?, ?, ?, ?, 'Programada', ?)
      `;
      db.run(
        sql,
        [
          data.patient_name.trim(),
          data.patient_phone ? data.patient_phone.trim() : null,
          data.treatment.trim(),
          data.appointment_date,
          data.appointment_time,
          data.created_by,
          data.patient_id || null
        ],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data, status: 'Programada' });
        }
      );
    });
  }

  /**
   * Modifica todos los datos de una cita existente.
   * @param {number|string} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  static update(id, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE appointments
        SET patient_name = ?, patient_phone = ?, treatment = ?, appointment_date = ?, appointment_time = ?, patient_id = ?
        WHERE id = ?
      `;
      db.run(
        sql,
        [
          data.patient_name.trim(),
          data.patient_phone ? data.patient_phone.trim() : null,
          data.treatment.trim(),
          data.appointment_date,
          data.appointment_time,
          data.patient_id || null,
          id
        ],
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  /**
   * Reprograma parcialmente una cita (fecha y hora).
   * @param {number|string} id
   * @param {string} date
   * @param {string} time
   * @returns {Promise<object>}
   */
  static patch(id, date, time) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE appointments
        SET appointment_date = ?, appointment_time = ?
        WHERE id = ?
      `;
      db.run(sql, [date, time, id], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  /**
   * Actualiza el estado de una cita.
   * @param {number|string} id
   * @param {string} status
   * @returns {Promise<object>}
   */
  static updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE appointments SET status = ? WHERE id = ?';
      db.run(sql, [status, id], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  /**
   * Cancela una cita (Soft Delete).
   * @param {number|string} id
   * @returns {Promise<object>}
   */
  static cancel(id) {
    return new Promise((resolve, reject) => {
      const sql = "UPDATE appointments SET status = 'Cancelada' WHERE id = ?";
      db.run(sql, [id], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  /**
   * Verifica si hay conflicto de horario para una fecha y hora dadas.
   * @param {string} date
   * @param {string} time
   * @param {number|string|null} excludeId
   * @returns {Promise<object|null>}
   */
  static checkConflict(date, time, excludeId = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT id FROM appointments
        WHERE appointment_date = ?
          AND appointment_time = ?
          AND status != 'Cancelada'
      `;
      const params = [date, time];
      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Guarda las observaciones clínicas y los tratamientos aplicados a una cita.
   * Ejecuta transacciones secuenciales.
   * @param {number|string} id - Cita ID
   * @param {string} observaciones - Observaciones clínicas
   * @param {Array<object>} tratamientos - Lista de objetos { id: tratamientoId, costo: costoAplicado }
   * @returns {Promise<void>}
   */
  static saveHistory(id, observaciones, tratamientos) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return reject(err);
        });

        // 1. Actualizar observaciones en la cita
        db.run(
          'UPDATE appointments SET observaciones_clinicas = ? WHERE id = ?',
          [observaciones || null, id],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
          }
        );

        // 2. Eliminar tratamientos asociados previamente
        db.run('DELETE FROM appointment_treatments WHERE appointment_id = ?', [id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
        });

        // 3. Insertar nuevos tratamientos asociados con el costo aplicado
        if (tratamientos && tratamientos.length > 0) {
          const stmt = db.prepare(
            'INSERT INTO appointment_treatments (appointment_id, treatment_id, costo_aplicado) VALUES (?, ?, ?)'
          );
          
          let insertError = null;
          for (const t of tratamientos) {
            stmt.run([id, t.id, t.costo], (err) => {
              if (err) insertError = err;
            });
          }
          
          stmt.finalize((err) => {
            if (err || insertError) {
              db.run('ROLLBACK');
              return reject(err || insertError);
            }
            
            db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } else {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        }
      });
    });
  }

  /**
   * Obtiene el historial clínico guardado para una cita específica.
   * @param {number|string} id - Cita ID
   * @returns {Promise<object>}
   */
  static getHistory(id) {
    return new Promise((resolve, reject) => {
      const sqlAppt = 'SELECT observaciones_clinicas FROM appointments WHERE id = ?';
      db.get(sqlAppt, [id], (err, apptRow) => {
        if (err) return reject(err);
        if (!apptRow) return resolve(null);

        const sqlTreats = `
          SELECT at.treatment_id AS id, t.nombre, at.costo_aplicado AS costo
          FROM appointment_treatments at
          JOIN treatments t ON at.treatment_id = t.id
          WHERE at.appointment_id = ?
        `;
        db.all(sqlTreats, [id], (err, treatRows) => {
          if (err) return reject(err);
          resolve({
            observaciones_clinicas: apptRow.observaciones_clinicas,
            tratamientos: treatRows || []
          });
        });
      });
    });
  }
}

module.exports = CitasRepository;
