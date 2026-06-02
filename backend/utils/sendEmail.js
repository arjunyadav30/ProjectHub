const transporter = require('../config/nodemailer');

const emailSendTimeout = parseInt(process.env.EMAIL_SEND_TIMEOUT || '15000');

const getClientUrl = (path = '/') => {
  const base = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const cleanPath = `/${String(path || '').replace(/^\/+/, '')}`;
  return `${base}${cleanPath}`;
};

const withTimeout = (promise, timeoutMs) => {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Email send timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
};

const sendEmail = async ({ to, subject, html }) => {
  return withTimeout(transporter.sendMail({
    from: process.env.EMAIL_FROM || `"ProjectHub" <${process.env.EMAIL_USER || 'no-reply@projecthub.local'}>`,
    to,
    subject,
    html,
  }), emailSendTimeout);
};

exports.sendCredentialsEmail = async (email, name, loginEmail, password) => {
  const loginUrl = getClientUrl('/projecthub/login');
  return sendEmail({
    to: email,
    subject: 'Welcome to ProjectHub - Your Login Credentials',
    html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;">
      <h2 style="color:#1d4ed8;">Welcome to ProjectHub, ${name}!</h2>
      <p>Your account has been created. Here are your login credentials:</p>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
        <p><strong>Email:</strong> ${loginEmail}</p>
        <p><strong>Temporary Password:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:4px;">${password}</code></p>
      </div>
      <p>Please <a href="${loginUrl}" style="color:#1d4ed8;">login here</a> and change your password immediately.</p>
      <p style="color:#6b7280;font-size:12px;">This is an automated message from ProjectHub.</p>
    </div>`,
  });
};

exports.sendPasswordResetEmail = async (email, name, token) => {
  const resetUrl = getClientUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  return sendEmail({
    to: email,
    subject: 'ProjectHub - Password Reset Request',
    html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;">
      <h2 style="color:#1d4ed8;">Password Reset</h2>
      <p>Hi ${name}, we received a request to reset your password.</p>
      <p><a href="${resetUrl}" style="background:#1d4ed8;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">Reset Password</a></p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    </div>`,
  });
};

exports.sendVerificationEmail = async (email, name, token) => {
  const url = getClientUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  return sendEmail({
    to: email,
    subject: 'ProjectHub - Verify your email',
    html: `<p>Hi ${name}, <a href="${url}">click here to verify your email</a>.</p>`,
  });
};

exports.sendTeamInviteEmail = async (email, name, teamName, eventTitle) => {
  const notificationsUrl = getClientUrl('/notifications');
  return sendEmail({
    to: email,
    subject: `ProjectHub - Team Invitation: ${teamName}`,
    html: `<p>Hi ${name}, you have been invited to join team <strong>${teamName}</strong> for <strong>${eventTitle}</strong>.</p>
      <p><a href="${notificationsUrl}">Open notifications</a> to accept or reject.</p>`,
  });
};

exports.sendLeaderRequestEmail = async (email, name, teamName, eventTitle, acceptToken, rejectToken) => {
  const notificationsUrl = getClientUrl('/notifications');
  return sendEmail({
    to: email,
    subject: `ProjectHub - Team Leader Request: ${teamName}`,
    html: `<p>Hi ${name}, you have been selected as team leader for <strong>${teamName}</strong> in <strong>${eventTitle}</strong>.</p>
      <p><a href="${notificationsUrl}">Open notifications</a> to respond.</p>`,
  });
};

exports.sendRegistrationStatusEmail = async (email, name, teamName, status, reason) => {
  const projectsUrl = getClientUrl('/student/projects');
  return sendEmail({
    to: email,
    subject: `ProjectHub - Team Registration ${status === 'approved' ? 'Approved' : 'Rejected'}`,
    html: `<p>Hi ${name}, your team <strong>${teamName}</strong> registration has been <strong>${status}</strong>${reason ? `. Reason: ${reason}` : ''}.</p>
      <p><a href="${projectsUrl}">Open my projects</a></p>`,
  });
};

exports.sendFacultyAssignedEmail = async (email, name, teamName, facultyName) => {
  const projectsUrl = getClientUrl('/student/projects');
  return sendEmail({
    to: email,
    subject: 'ProjectHub - Mentor Faculty Assigned',
    html: `<p>Hi ${name}, <strong>${facultyName}</strong> has been assigned as your team <strong>${teamName}</strong>'s mentor.</p>
      <p><a href="${projectsUrl}">Open my projects</a></p>`,
  });
};
