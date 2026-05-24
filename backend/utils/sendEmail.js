const transporter = require('../config/nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: `"ProjectHub" <${process.env.EMAIL_USER || 'no-reply@projecthub.local'}>`,
    to,
    subject,
    html,
  });
};

exports.sendCredentialsEmail = async (email, name, loginEmail, password) => {
  const clientUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
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
      <p>Please <a href="${clientUrl}/login" style="color:#1d4ed8;">login here</a> and change your password immediately.</p>
      <p style="color:#6b7280;font-size:12px;">This is an automated message from ProjectHub.</p>
    </div>`,
  });
};

exports.sendPasswordResetEmail = async (email, name, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
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
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'ProjectHub - Verify your email',
    html: `<p>Hi ${name}, <a href="${url}">click here to verify your email</a>.</p>`,
  });
};

exports.sendTeamInviteEmail = async (email, name, teamName, eventTitle) => {
  return sendEmail({
    to: email,
    subject: `ProjectHub - Team Invitation: ${teamName}`,
    html: `<p>Hi ${name}, you have been invited to join team <strong>${teamName}</strong> for <strong>${eventTitle}</strong>. Please login to accept or reject.</p>`,
  });
};

exports.sendLeaderRequestEmail = async (email, name, teamName, eventTitle, acceptToken, rejectToken) => {
  return sendEmail({
    to: email,
    subject: `ProjectHub - Team Leader Request: ${teamName}`,
    html: `<p>Hi ${name}, you have been selected as team leader for <strong>${teamName}</strong> in <strong>${eventTitle}</strong>. Please login to respond.</p>`,
  });
};

exports.sendRegistrationStatusEmail = async (email, name, teamName, status, reason) => {
  return sendEmail({
    to: email,
    subject: `ProjectHub - Team Registration ${status === 'approved' ? 'Approved' : 'Rejected'}`,
    html: `<p>Hi ${name}, your team <strong>${teamName}</strong> registration has been <strong>${status}</strong>${reason ? `. Reason: ${reason}` : ''}.</p>`,
  });
};

exports.sendFacultyAssignedEmail = async (email, name, teamName, facultyName) => {
  return sendEmail({
    to: email,
    subject: 'ProjectHub - Mentor Faculty Assigned',
    html: `<p>Hi ${name}, <strong>${facultyName}</strong> has been assigned as your team <strong>${teamName}</strong>'s mentor.</p>`,
  });
};
