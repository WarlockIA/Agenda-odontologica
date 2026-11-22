const db = require('../db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * GET /api/reportes/financiero
 * Retorna las métricas financieras clave de la clínica para el odontólogo:
 * - KPIs generales (Total Cobrado, Total Facturado, Deuda Global)
 * - Histórico mensual (Ingresos y Facturación por mes)
 * - Ranking de pacientes deudores (Top 10)
 */
const getFinancialReport = catchAsync(async (req, res, next) => {
  const period = req.query.period || 'este_mes';
  let dateFilterEvolucion = '';
  let dateFilterAppointments = '';
  let dateParamsEvolucion = [];
  let dateParamsAppointments = [];

  const now = new Date();
  
  if (period === 'hoy') {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    dateFilterEvolucion = 'WHERE fecha = ?';
    dateParamsEvolucion = [todayStr];
    dateFilterAppointments = 'WHERE appointment_date = ?';
    dateParamsAppointments = [todayStr];
  } else if (period === 'esta_semana') {
    const day = now.getDay();
    const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(now.setDate(diffToMon));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    const start = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
    const end = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
    dateFilterEvolucion = 'WHERE fecha BETWEEN ? AND ?';
    dateParamsEvolucion = [start, end];
    dateFilterAppointments = 'WHERE appointment_date BETWEEN ? AND ?';
    dateParamsAppointments = [start, end];
  } else if (period === 'este_mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    dateFilterEvolucion = 'WHERE fecha BETWEEN ? AND ?';
    dateParamsEvolucion = [start, end];
    dateFilterAppointments = 'WHERE appointment_date BETWEEN ? AND ?';
    dateParamsAppointments = [start, end];
  } else if (period === 'mes_pasado') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    dateFilterEvolucion = 'WHERE fecha BETWEEN ? AND ?';
    dateParamsEvolucion = [start, end];
    dateFilterAppointments = 'WHERE appointment_date BETWEEN ? AND ?';
    dateParamsAppointments = [start, end];
  } else if (period === 'este_anio') {
    const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
    dateFilterEvolucion = 'WHERE fecha BETWEEN ? AND ?';
    dateParamsEvolucion = [start, end];
    dateFilterAppointments = 'WHERE appointment_date BETWEEN ? AND ?';
    dateParamsAppointments = [start, end];
  } else if (period === 'ultimos_3_meses') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    dateFilterEvolucion = 'WHERE fecha BETWEEN ? AND ?';
    dateParamsEvolucion = [start, end];
    dateFilterAppointments = 'WHERE appointment_date BETWEEN ? AND ?';
    dateParamsAppointments = [start, end];
  } else if (period === 'ultimos_6_meses') {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    dateFilterEvolucion = 'WHERE fecha BETWEEN ? AND ?';
    dateParamsEvolucion = [start, end];
    dateFilterAppointments = 'WHERE appointment_date BETWEEN ? AND ?';
    dateParamsAppointments = [start, end];
  } else if (period === 'custom') {
    const start = req.query.start_date || '1970-01-01';
    const end = req.query.end_date || '2099-12-31';
    dateFilterEvolucion = 'WHERE fecha BETWEEN ? AND ?';
    dateParamsEvolucion = [start, end];
    dateFilterAppointments = 'WHERE appointment_date BETWEEN ? AND ?';
    dateParamsAppointments = [start, end];
  }

  // 1. Obtener KPIs generales de ingresos y facturación histórica
  const kpisSql = `
    SELECT 
      COALESCE(SUM(debe), 0) as total_facturado,
      COALESCE(SUM(haber), 0) as total_ingresos
    FROM evolucion_tratamientos
    ${dateFilterEvolucion}
  `;
  const kpis = await new Promise((resolve, reject) => {
    db.get(kpisSql, dateParamsEvolucion, (err, r) => {
      if (err) reject(err);
      else resolve(r);
    });
  });

  // 2. Calcular la deuda global real (suma de saldos positivos individuales)
  const debtSql = `
    SELECT COALESCE(SUM(saldo_deuda), 0) as total_deuda FROM (
      SELECT (SUM(debe) - SUM(haber)) as saldo_deuda
      FROM evolucion_tratamientos
      ${dateFilterEvolucion}
      GROUP BY paciente_id
      HAVING saldo_deuda > 0
    )
  `;
  const debtResult = await new Promise((resolve, reject) => {
    db.get(debtSql, dateParamsEvolucion, (err, r) => {
      if (err) reject(err);
      else resolve(r);
    });
  });

  // 3. Obtener histórico de ingresos y facturación filtrado por el período seleccionado
  const monthlySql = `
    SELECT 
      strftime('%Y-%m', fecha) as mes,
      COALESCE(SUM(haber), 0) as ingresos,
      COALESCE(SUM(debe), 0) as facturado
    FROM evolucion_tratamientos
    ${dateFilterEvolucion}
    GROUP BY mes
    ORDER BY mes ASC
  `;
  let monthlyData = await new Promise((resolve, reject) => {
    db.all(monthlySql, dateParamsEvolucion, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // Si no hay transacciones registradas en el período seleccionado, generar fila con 0 Bs para el mes correspondiente
  if (!monthlyData || monthlyData.length === 0) {
    if (period === 'este_mes') {
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      monthlyData = [{ mes: `${yyyy}-${mm}`, ingresos: 0, facturado: 0 }];
    } else if (period === 'mes_pasado') {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const yyyy = prevDate.getFullYear();
      const mm = String(prevDate.getMonth() + 1).padStart(2, '0');
      monthlyData = [{ mes: `${yyyy}-${mm}`, ingresos: 0, facturado: 0 }];
    }
  }

  // 4. Obtener el ranking de los 10 pacientes con mayor deuda pendiente
  const debtorsSql = `
    SELECT 
      p.id,
      p.nombre_completo,
      p.ci,
      p.telefono,
      MAX(e.fecha) as ultima_atencion,
      SUM(e.debe) as total_facturado,
      SUM(e.haber) as total_cobrado,
      (SUM(e.debe) - SUM(e.haber)) as saldo_deuda
    FROM patients p
    JOIN evolucion_tratamientos e ON p.id = e.paciente_id
    ${dateFilterEvolucion ? 'WHERE e.fecha BETWEEN ? AND ?' : ''}
    GROUP BY p.id
    HAVING saldo_deuda > 0
    ORDER BY saldo_deuda DESC
    LIMIT 10
  `;
  const debtors = await new Promise((resolve, reject) => {
    db.all(debtorsSql, dateParamsEvolucion, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // 5. Obtener los tratamientos más solicitados
  const extraAppointmentsWhere = dateFilterAppointments ? 'AND a.appointment_date BETWEEN ? AND ?' : '';
  const extraEvolucionWhere = dateFilterEvolucion ? 'AND e.fecha BETWEEN ? AND ?' : '';
  
  const treatmentStatsSql = `
    WITH stats AS (
      SELECT 
        t.nombre, 
        t.color, 
        (
          SELECT COUNT(*) FROM appointment_treatments at 
          JOIN appointments a ON at.appointment_id = a.id
          WHERE at.treatment_id = t.id ${extraAppointmentsWhere}
        ) + (
          SELECT COUNT(*) FROM evolucion_tratamientos e 
          WHERE e.trabajo_realizado = t.nombre ${extraEvolucionWhere}
        ) as cantidad,
        (
          SELECT COALESCE(SUM(at.costo_aplicado), 0) FROM appointment_treatments at 
          JOIN appointments a ON at.appointment_id = a.id
          WHERE at.treatment_id = t.id ${extraAppointmentsWhere}
        ) + (
          SELECT COALESCE(SUM(e.debe), 0) FROM evolucion_tratamientos e 
          WHERE e.trabajo_realizado = t.nombre ${extraEvolucionWhere}
        ) as total_recaudado
      FROM treatments t
    )
    SELECT * FROM stats
    WHERE cantidad > 0
    ORDER BY cantidad DESC, total_recaudado DESC
  `;
  const treatmentParams = [
    ...dateParamsAppointments,
    ...dateParamsEvolucion,
    ...dateParamsAppointments,
    ...dateParamsEvolucion
  ];
  const treatmentStats = await new Promise((resolve, reject) => {
    db.all(treatmentStatsSql, treatmentParams, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // 6. Obtener ingresos y facturación agrupados por categoría de tratamiento
  const categoryStatsSql = `
    SELECT 
      COALESCE(t.categoria, 'General') as categoria,
      COALESCE(SUM(e.haber), 0) as ingresos,
      COALESCE(SUM(e.debe), 0) as facturado,
      COUNT(e.id) as cantidad
    FROM evolucion_tratamientos e
    LEFT JOIN treatments t ON e.trabajo_realizado = t.nombre
    ${dateFilterEvolucion}
    GROUP BY categoria
    ORDER BY ingresos DESC
  `;
  const categoryStats = await new Promise((resolve, reject) => {
    db.all(categoryStatsSql, dateParamsEvolucion, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // 7. Obtener estadísticas de citas (Ausentismo y Eficiencia)
  const apptStatsSql = `
    SELECT status, COUNT(*) as count 
    FROM appointments 
    ${dateFilterAppointments}
    GROUP BY status
  `;
  const apptStats = await new Promise((resolve, reject) => {
    db.all(apptStatsSql, dateParamsAppointments, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  let totalAppointments = 0;
  let atendidas = 0;
  let ausentes = 0;
  let programadas = 0;
  let enEspera = 0;
  let canceladas = 0;

  apptStats.forEach(row => {
    const count = row.count || 0;
    if (row.status === 'Atendida' || row.status === 'Completada') atendidas += count;
    else if (row.status === 'Ausente' || row.status === 'No Asistió') ausentes += count;
    else if (row.status === 'Programada') programadas += count;
    else if (row.status === 'En Espera') enEspera += count;
    else if (row.status === 'Cancelada') canceladas += count;
    
    if (row.status !== 'Cancelada') {
      totalAppointments += count;
    }
  });

  const tasaAusentismo = totalAppointments > 0 ? Math.round((ausentes / totalAppointments) * 100) : 0;
  const eficienciaAgenda = totalAppointments > 0 ? Math.round((atendidas / totalAppointments) * 100) : 0;

  res.status(200).json({
    success: true,
    kpis: {
      totalFacturado: kpis.total_facturado,
      totalIngresos: kpis.total_ingresos,
      totalDeuda: debtResult.total_deuda,
      tasaAusentismo,
      eficienciaAgenda
    },
    ingresosMensuales: monthlyData,
    pacientesDeudores: debtors,
    tratamientosMasComunes: treatmentStats,
    ingresosPorCategoria: categoryStats,
    citasProporciones: {
      programadas,
      enEspera,
      atendidas,
      ausentes,
      canceladas
    }
  });
});

module.exports = {
  getFinancialReport
};
