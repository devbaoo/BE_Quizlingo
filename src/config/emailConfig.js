import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Gửi email
const sendEmail = async (mailOptions) => {
  try {
    // Gửi email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Email sending error:", error);
    throw error;
  }
};

// Template email xác thực
const verificationEmailTemplate = (name, verificationLink) => {
  return {
    subject: "Xác thực tài khoản QuizLingo của bạn",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4a6ee0;">QuizLingo - Xác thực tài khoản</h2>
        <p>Xin chào <strong>${name}</strong>,</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản trên QuizLingo. Để hoàn tất quá trình đăng ký, vui lòng xác thực tài khoản của bạn bằng cách nhấp vào liên kết bên dưới:</p>
        <div style="margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #4a6ee0; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Xác thực tài khoản</a>
        </div>
        <p>Hoặc bạn có thể sao chép liên kết này vào trình duyệt của bạn:</p>
        <p style="word-break: break-all; color: #666;">${verificationLink}</p>
        <p>Liên kết này sẽ hết hạn sau 24 giờ.</p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
        <p>Trân trọng,<br>Đội ngũ QuizLingo</p>
      </div>
    `,
  };
};

// Template email reset password
const resetPasswordEmailTemplate = (name, resetLink) => {
  return {
    subject: "Đặt lại mật khẩu QuizLingo của bạn",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4a6ee0;">QuizLingo - Đặt lại mật khẩu</h2>
        <p>Xin chào <strong>${name}</strong>,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản QuizLingo của bạn. Vui lòng nhấp vào liên kết bên dưới để đặt lại mật khẩu:</p>
        <div style="margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #4a6ee0; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Đặt lại mật khẩu</a>
        </div>
        <p>Hoặc bạn có thể sao chép liên kết này vào trình duyệt của bạn:</p>
        <p style="word-break: break-all; color: #666;">${resetLink}</p>
        <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. Mật khẩu của bạn sẽ không bị thay đổi.</p>
        <p>Trân trọng,<br>Đội ngũ QuizLingo</p>
      </div>
    `,
  };
};

export { sendEmail, verificationEmailTemplate, resetPasswordEmailTemplate };
