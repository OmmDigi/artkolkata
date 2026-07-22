export const emailConf = () => {
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
  return {
    host: process.env.SMTP_HOST,
    port: SMTP_PORT, // Use 465 for SSL or 587 for TLS
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER, // Your email address
      pass: process.env.SMTP_PASSWORD, // Your email account password
    },
  };
};
