const nodemailer = require('nodemailer');
const dns = require('dns');

dns.setDefaultResultOrder?.('ipv4first');

const smtpHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.EMAIL_PORT || '587');
const smtpSecure = String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
const smtpFallbackEnabled = String(process.env.EMAIL_SMTP_FALLBACK || 'true').toLowerCase() !== 'false';

const getFallbackConfigs = () => {
  if (!smtpFallbackEnabled) return [];
  return [
    { port: 587, secure: false },
    { port: 465, secure: true },
    { port: 2525, secure: false },
  ].filter(config => config.port !== smtpPort);
};

const createTransporter = (port, secure) => nodemailer.createTransport({
  host: smtpHost,
  port,
  secure,
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
  const fallbackTransporters = getFallbackConfigs().map(config => ({
    ...config,
    transporter: createTransporter(config.port, config.secure),
  }));

  transporter = {
    sendMail: async (options) => {
      try {
        return await primaryTransporter.sendMail(options);
      } catch (error) {
        let lastError = error;

        for (const fallback of fallbackTransporters) {
          try {
            console.warn(`Primary SMTP failed (${smtpPort}/${smtpSecure ? 'SSL' : 'STARTTLS'}). Retrying with ${fallback.port}/${fallback.secure ? 'SSL' : 'STARTTLS'}...`);
            return await fallback.transporter.sendMail(options);
          } catch (fallbackError) {
            lastError = fallbackError;
          }
        }

        throw lastError;
      }
    },
    verify: async () => {
      let lastError;
      const transports = [
        { port: smtpPort, secure: smtpSecure, transporter: primaryTransporter },
        ...fallbackTransporters,
      ];

      for (const config of transports) {
        try {
          await config.transporter.verify();
          return true;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
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
