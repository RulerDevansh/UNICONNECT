const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendVerificationEmail = async (user) => {
  if (process.env.NODE_ENV !== 'production') return;
  const verifyLink = `${process.env.FRONTEND_URL}/verify?email=${user.email}`;
  await transporter.sendMail({
    from: 'UniConnect <no-reply@uniconnect.dev>',
    to: user.email,
    subject: 'Verify your UniConnect email',
    html: `<p>Click to verify: <a href="${verifyLink}">${verifyLink}</a></p>`,
  });
};

module.exports = { sendVerificationEmail };
