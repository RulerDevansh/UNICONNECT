const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a 6-digit OTP verification code to the user's email.
 * @param {object} user  - Mongoose user doc with .email
 * @param {string} code  - The 6-digit OTP code
 */
const sendVerificationEmail = async (user, code) => {
  await transporter.sendMail({
    from: `UniConnect <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'Your UniConnect email verification code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
        <h2 style="color:#a78bfa;margin-bottom:8px">Verify your email</h2>
        <p style="color:#94a3b8">Enter this code in the app to confirm your email address. It expires in <strong>10 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:12px;background:#1e293b;border-radius:8px;padding:20px;text-align:center;margin:24px 0;color:#a78bfa">
          ${code}
        </div>
        <p style="font-size:12px;color:#475569">If you did not create a UniConnect account, please ignore this email.</p>
      </div>
    `,
  });
};

/**
 * Send a 6-digit OTP for password reset.
 * @param {object} user  - Mongoose user doc with .email
 * @param {string} code  - The 6-digit OTP code
 */
const sendPasswordResetEmail = async (user, code) => {
  await transporter.sendMail({
    from: `UniConnect <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'UniConnect — Password Reset Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
        <h2 style="color:#f472b6;margin-bottom:8px">Reset your password</h2>
        <p style="color:#94a3b8">Use this code to reset your UniConnect password. It expires in <strong>10 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:12px;background:#1e293b;border-radius:8px;padding:20px;text-align:center;margin:24px 0;color:#f472b6">
          ${code}
        </div>
        <p style="font-size:12px;color:#475569">If you did not request a password reset, please ignore this email. Your password will not change.</p>
      </div>
    `,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
