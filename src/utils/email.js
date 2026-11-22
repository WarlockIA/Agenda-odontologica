const nodemailer = require('nodemailer');

/**
 * Servicio de envío de correos utilizando Nodemailer.
 * En modo desarrollo utiliza Ethereal Email (un servicio SMTP de pruebas gratuito)
 * para capturar correos sin enviarlos realmente a bandejas reales.
 */

// Crear una cuenta de prueba de Ethereal automáticamente al iniciar si no hay config
let transporter;

async function initTransporter() {
  if (!transporter) {
    // Si tienes SMTP real, configúralo en las variables de entorno (.env)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_PORT == 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('Servicio SMTP Real Configurado');
    } else {
      // Fallback a Ethereal para desarrollo
      console.log('Configurando Ethereal Email de prueba...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      console.log('Ethereal Email configurado para pruebas locales.');
    }
  }
  return transporter;
}

/**
 * Enviar un correo electrónico genérico
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const mailTransporter = await initTransporter();
    
    const mailOptions = {
      from: '"Consultorio Cristo Rey" <no-reply@cristoreyodontologia.com>',
      to,
      subject,
      html,
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`Correo enviado a ${to} - Message ID: ${info.messageId}`);
    
    // Si usamos Ethereal, mostrar el link para visualizar el correo real
    if (info.messageId && mailTransporter.options.host === 'smtp.ethereal.email') {
      console.log('Visita esta URL para ver el correo simulado: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return true;
  } catch (error) {
    console.error('Error enviando correo:', error);
    return false;
  }
};

module.exports = {
  sendEmail
};
