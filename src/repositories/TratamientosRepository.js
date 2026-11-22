const db = require('../db');

class TratamientosRepository {
  /**
   * Obtiene todos los tratamientos del catálogo.
   * @param {boolean} soloActivos - Si es true, solo retorna los tratamientos con activo = 1.
   * @returns {Promise<Array>}
   */
  static findAll(soloActivos = false) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT id, nombre, costo_base, activo, color, categoria FROM treatments WHERE eliminado = 0';
      const params = [];

      if (soloActivos) {
        sql += ' AND activo = 1';
      }

      sql += ' ORDER BY nombre ASC';

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Busca un tratamiento por su ID único.
   * @param {number|string} id
   * @returns {Promise<object|null>}
   */
  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, nombre, costo_base, activo, color, categoria FROM treatments WHERE id = ? AND eliminado = 0';
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Busca un tratamiento por su nombre exacto (para validaciones de duplicados).
   * @param {string} nombre
   * @returns {Promise<object|null>}
   */
  static findByName(nombre) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, nombre, costo_base, activo, color, categoria FROM treatments WHERE nombre = ? AND eliminado = 0';
      db.get(sql, [nombre.trim()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Registra un nuevo tratamiento en el catálogo.
   * @param {object} data
   * @returns {Promise<object>}
   */
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO treatments (nombre, costo_base, color, categoria, activo) VALUES (?, ?, ?, ?, 1)';
      const colorVal = data.color || '#3b82f6';
      const categoriaVal = data.categoria ? data.categoria.trim() : 'General';
      db.run(sql, [data.nombre.trim(), data.costo_base, colorVal, categoriaVal], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, nombre: data.nombre.trim(), costo_base: data.costo_base, color: colorVal, categoria: categoriaVal, activo: 1 });
        }
      });
    });
  }

  /**
   * Actualiza los datos de un tratamiento existente.
   * @param {number|string} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  static update(id, data) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE treatments SET nombre = ?, costo_base = ?, activo = ?, color = ?, categoria = ? WHERE id = ?';
      const colorVal = data.color || '#3b82f6';
      const categoriaVal = data.categoria ? data.categoria.trim() : 'General';
      db.run(sql, [data.nombre.trim(), data.costo_base, data.activo !== undefined ? data.activo : 1, colorVal, categoriaVal, id], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: parseInt(id), nombre: data.nombre.trim(), costo_base: data.costo_base, activo: data.activo, color: colorVal, categoria: categoriaVal });
        }
      });
    });
  }

  /**
   * Realiza la deshabilitación lógica de un tratamiento (borrado lógico).
   * Cambia el estado a inactivo (activo = 0).
   * @param {number|string} id
   * @returns {Promise<object>}
   */
  static deactivate(id) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE treatments SET activo = 0 WHERE id = ?';
      db.run(sql, [id], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: parseInt(id), activo: 0 });
        }
      });
    });
  }

  /**
   * Realiza el borrado físico de un tratamiento en la base de datos.
   * @param {number|string} id
   * @returns {Promise<object>}
   */
  static delete(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM treatments WHERE id = ?';
      db.run(sql, [id], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: parseInt(id) });
        }
      });
    });
  }

  /**
   * Realiza la deshabilitación lógica por eliminación de un tratamiento.
   * Cambia el estado eliminado a 1 y activo a 0.
   * @param {number|string} id
   * @returns {Promise<object>}
   */
  static logicalDelete(id) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE treatments SET eliminado = 1, activo = 0 WHERE id = ?';
      db.run(sql, [id], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: parseInt(id), eliminado: 1, activo: 0 });
        }
      });
    });
  }

  /**
   * Obtiene la cantidad de veces que un tratamiento ha sido usado en citas o fichas.
   * @param {number|string} id - ID del tratamiento
   * @returns {Promise<number>}
   */
  static getUsageCount(id) {
    return new Promise(async (resolve, reject) => {
      try {
        const treatment = await this.findById(id);
        if (!treatment) {
          return resolve(0);
        }

        const sqlCitas = 'SELECT COUNT(*) AS count FROM appointment_treatments WHERE treatment_id = ?';
        db.get(sqlCitas, [id], (err, rowCitas) => {
          if (err) return reject(err);

          const countCitas = rowCitas ? rowCitas.count : 0;

          const sqlEvo = 'SELECT COUNT(*) AS count FROM evolucion_tratamientos WHERE trabajo_realizado = ?';
          db.get(sqlEvo, [treatment.nombre], (err, rowEvo) => {
            if (err) return reject(err);

            const countEvo = rowEvo ? rowEvo.count : 0;
            resolve(countCitas + countEvo);
          });
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = TratamientosRepository;
