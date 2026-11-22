const db = require('../db');
const catchAsync = require('../utils/catchAsync');

/**
 * GET /api/settings/clinic-hours
 * Retorna la configuración del horario de atención de la clínica.
 */
const getClinicHours = catchAsync(async (req, res, next) => {
  const sql = "SELECT value FROM settings WHERE key = 'clinic_hours'";
  
  const row = await new Promise((resolve, reject) => {
    db.get(sql, [], (err, r) => (err ? reject(err) : resolve(r)));
  });

  if (!row) {
    return res.status(200).json({
      workDays: [1, 2, 3, 4, 5],
      timeWindows: [
        { start: "08:00", end: "12:00" },
        { start: "14:00", end: "18:00" }
      ]
    });
  }

  res.status(200).json(JSON.parse(row.value));
});

const defaultProfile = {
  name: "Cristo Rey Odontología",
  slogan: "Consultorio Odontológico Especializado",
  address: "Av. Las Américas N° 45, Yacuiba",
  phone: "+591 70000000",
  nit: "1234567018",
  logoType: "tooth_clean",
  logoUrl: ""
};

/**
 * GET /api/settings/clinic-profile
 * Retorna el perfil e información institucional de la clínica.
 */
const getClinicProfile = catchAsync(async (req, res, next) => {
  const sql = "SELECT value FROM settings WHERE key = 'clinic_profile'";

  const row = await new Promise((resolve, reject) => {
    db.get(sql, [], (err, r) => (err ? reject(err) : resolve(r)));
  });

  if (!row) {
    return res.status(200).json(defaultProfile);
  }

  try {
    const profile = JSON.parse(row.value);
    res.status(200).json({ ...defaultProfile, ...profile });
  } catch (e) {
    res.status(200).json(defaultProfile);
  }
});

/**
 * PUT /api/settings/clinic-profile
 * Actualiza el perfil e información institucional de la clínica.
 */
const updateClinicProfile = catchAsync(async (req, res, next) => {
  const { name, slogan, address, phone, nit, logoType, logoUrl } = req.body;

  const profileData = {
    name: name || defaultProfile.name,
    slogan: slogan || defaultProfile.slogan,
    address: address || defaultProfile.address,
    phone: phone || defaultProfile.phone,
    nit: nit || defaultProfile.nit,
    logoType: logoType || defaultProfile.logoType,
    logoUrl: logoUrl || ""
  };

  const sql = `
    INSERT INTO settings (key, value)
    VALUES ('clinic_profile', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `;

  await new Promise((resolve, reject) => {
    db.run(sql, [JSON.stringify(profileData)], (err) => (err ? reject(err) : resolve()));
  });

  res.status(200).json({
    message: "Perfil de la clínica guardado correctamente.",
    profile: profileData
  });
});

module.exports = {
  getClinicHours,
  getClinicProfile,
  updateClinicProfile
};
