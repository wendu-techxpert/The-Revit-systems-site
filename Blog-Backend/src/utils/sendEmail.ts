import nodemailer from "nodemailer";

export const sendEmail = async (options: {
  email: string;
  subject: string;
  message: string;
}) => {
  // 1. Create the Transporter using SendGrid's SMTP settings
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false, // Must be false for port 587
    auth: {
      user: process.env.EMAIL_USER, // this is "apikey"
      pass: process.env.EMAIL_PASSWORD, // your SG key
    },
  });

  // 2. Define the email content
  const mailOptions = {
    from: `"Revit Systems Security" <${process.env.SENDGRID_FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // 3. Send it
  try {
    await transporter.sendMail(mailOptions);
    console.log(`SMTP Email sent successfully to ${options.email}`);
  } catch (error) {
    console.error("SMTP Error:", error);
    throw new Error("Failed to send email via SMTP");
  }
};
