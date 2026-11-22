const TratamientosRepository = require('../repositories/TratamientosRepository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * GET /api/tratamientos
 * Obtiene la lista de todos los tratamientos.
 * Soporta el filtro ?soloActivos=true.
 */
const getTreatments = catchAsync(async (req, res, next) => {
  const soloActivos = req.query.soloActivos === 'true';
  const treatments = await TratamientosRepository.findAll(soloActivos);
  
  res.status(200).json({
    success: true,
    treatments
  });
});

/**
 * POST /api/tratamientos
 * Registra un nuevo tratamiento en el catálogo.
 * Valida duplicados de nombre.
 */
const createTreatment = catchAsync(async (req, res, next) => {
  const { nombre, costo_base, color, categoria } = req.body;

  if (!nombre || !nombre.trim()) {
    throw new AppError('El nombre del tratamiento es obligatorio.', 400);
  }
  if (costo_base === undefined || costo_base === null) {
    throw new AppError('El costo base es obligatorio.', 400);
  }

  // Validar duplicado de nombre preventivamente
  const existing = await TratamientosRepository.findByName(nombre);
  if (existing) {
    throw new AppError('El tratamiento con este nombre ya se encuentra registrado.', 400);
  }

  const treatment = await TratamientosRepository.create({
    nombre,
    costo_base,
    color,
    categoria
  });

  res.status(201).json({
    success: true,
    message: 'Tratamiento registrado con éxito.',
    treatment
  });
});

/**
 * PUT /api/tratamientos/:id
 * Actualiza los datos de un tratamiento existente.
 */
const updateTreatment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { nombre, costo_base, activo, color, categoria } = req.body;

  const treatment = await TratamientosRepository.findById(id);
  if (!treatment) {
    throw new AppError('El tratamiento especificado no existe.', 404);
  }

  // Validar si el nuevo nombre choca con otro registro existente
  if (nombre && nombre.trim().toLowerCase() !== treatment.nombre.toLowerCase()) {
    const existing = await TratamientosRepository.findByName(nombre);
    if (existing && existing.id !== parseInt(id)) {
      throw new AppError('Ya existe otro tratamiento registrado con este nombre.', 400);
    }
  }

  // Convertir booleano o número a entero para SQLite
  let activoVal = treatment.activo;
  if (activo !== undefined) {
    activoVal = (activo === true || activo === 1 || activo === '1') ? 1 : 0;
  }

  const updated = await TratamientosRepository.update(id, {
    nombre: nombre || treatment.nombre,
    costo_base: costo_base !== undefined ? costo_base : treatment.costo_base,
    activo: activoVal,
    color: color || treatment.color,
    categoria: categoria || treatment.categoria
  });

  res.status(200).json({
    success: true,
    message: 'Tratamiento actualizado con éxito.',
    treatment: updated
  });
});

/**
 * DELETE /api/tratamientos/:id
 * Remueve un tratamiento del catálogo.
 * CRÍTICO: Realiza un borrado lógico (UPDATE treatments SET activo = 0) para mantener la integridad histórica.
 */
const deleteTreatment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const treatment = await TratamientosRepository.findById(id);
  if (!treatment) {
    throw new AppError('El tratamiento especificado no existe.', 404);
  }

  // Verificar la cantidad de usos históricos
  const usageCount = await TratamientosRepository.getUsageCount(id);

  if (usageCount === 0) {
    // Si no se ha usado nunca, podemos borrarlo físicamente
    await TratamientosRepository.delete(id);
    res.status(200).json({
      success: true,
      message: 'Tratamiento eliminado físicamente del catálogo con éxito.'
    });
  } else {
    // Si tiene historial, hacemos desactivación lógica (borrado lógico)
    await TratamientosRepository.logicalDelete(id);
    res.status(200).json({
      success: true,
      message: 'Tratamiento retirado del catálogo con éxito (deshabilitación lógica para preservar el historial).'
    });
  }
});

/**
 * GET /api/tratamientos/:id/uso
 * Retorna la cantidad de veces que se ha usado el tratamiento en la base de datos (citas / ficha).
 */
const getTreatmentUsage = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const treatment = await TratamientosRepository.findById(id);
  if (!treatment) {
    throw new AppError('El tratamiento especificado no existe.', 404);
  }

  const usageCount = await TratamientosRepository.getUsageCount(id);

  res.status(200).json({
    success: true,
    usageCount
  });
});

module.exports = {
  getTreatments,
  createTreatment,
  updateTreatment,
  deleteTreatment,
  getTreatmentUsage
};
