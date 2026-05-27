const nodemailer = require('nodemailer');
const dns = require('dns');

dns.setDefaultResultOrder?.('ipv4first');

const smtpHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.EMAIL_PORT || '587');
const smtpSecure = String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;

const createTransporter = (port, secure) => nodemailer.createTransport({
  host: smtpHost,
  port,
  secure,
  family: 4,
  requireTLS: !secure,
  connectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT || '20000'),
  greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT || '15000'),
  socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT || '30000'),
  tls: {
    minVersion: 'TLSv1.2',
    servername: smtpHost,
  },
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

let transporter;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  const primaryTransporter = createTransporter(smtpPort, smtpSecure);
  const fallbackTransporter = smtpPort === 587
    ? createTransporter(465, true)
    : createTransporter(587, false);

  transporter = {
    sendMail: async (options) => {
      try {
        return await primaryTransporter.sendMail(options);
      } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        const code = String(error?.code || '').toUpperCase();
        const isTimeout = code.includes('TIMEOUT') || message.includes('timeout');

        if (!isTimeout) throw error;

        console.warn(`Primary SMTP failed (${smtpPort}/${smtpSecure ? 'SSL' : 'STARTTLS'}). Retrying with fallback...`);
        return fallbackTransporter.sendMail(options);
      }
    },
  };
} else {
  // Dev fallback: log emails instead of sending
  console.warn('Email not configured - emails will be logged to console only.');
  transporter = {
    sendMail: async (options) => {
      console.log('\n[DEV EMAIL - not actually sent]');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('---\n');
      return { messageId: 'dev-mode' };
    },
  };
}

module.exports = transporter;
