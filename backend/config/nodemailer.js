const nodemailer = require('nodemailer');
const dns = require('dns');

dns.setDefaultResultOrder?.('ipv4first');

let transporter;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    family: 4,
    requireTLS: true,
    connectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT || '20000'),
    greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT || '15000'),
    socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT || '30000'),
    tls: {
      minVersion: 'TLSv1.2',
      servername: process.env.EMAIL_HOST || 'smtp.gmail.com',
    },
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
} else {
  // Dev fallback — log emails to console instead of sending
  console.warn('⚠️  Email not configured — emails will be logged to console only.');
  transporter = {
    sendMail: async (options) => {
      console.log('\n📧 [DEV EMAIL - not actually sent]');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('---\n');
      return { messageId: 'dev-mode' };
    },
  };
}

module.exports = transporter;
