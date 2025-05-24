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
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác thực tài khoản QuizLingo</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden; margin: 0 auto;">
                
                <!-- Header với gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <div style="font-size: 60px; margin-bottom: 20px;">
                      ✉️
                    </div>
                    <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 10px 0; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                      Quizlingo
                    </h1>
                    <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 0; font-weight: 500;">
                      Xác thực tài khoản của bạn
                    </p>
                  </td>
                </tr>
                
                <!-- Content chính -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                      Chào ${name}! 👋
                    </h2>
                    
                    <div style="background: #1e293b; padding: 30px; border-radius: 12px; margin: 20px 0; border: 1px solid #475569;">
                      <div style="color: #ffffff; font-size: 16px; line-height: 1.8; font-weight: 500;">
                        Cảm ơn bạn đã đăng ký tài khoản trên QuizLingo. Để hoàn tất quá trình đăng ký, vui lòng xác thực tài khoản của bạn bằng cách nhấp vào nút bên dưới.
                      </div>
                    </div>
                    
                    <!-- Verification info -->
                    <div style="background: #7f1d1d; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center; border: 1px solid #991b1b;">
                      <div style="font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 10px;">
                        ⚡️ Liên kết sẽ hết hạn sau 24 giờ
                      </div>
                      <div style="font-size: 14px; color: #fecaca; font-weight: 500;">
                        Hãy xác thực ngay để bắt đầu hành trình học tập của bạn!
                      </div>
                    </div>
                    
                    <!-- Call to Action Button -->
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.3s ease;">
                        ✨ Xác thực tài khoản
                      </a>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 14px; margin: 10px 0;">
                      <strong>💫 Quizlingo Team</strong><br>
                      Cùng bạn chinh phục tiếng Anh mỗi ngày!
                    </p>
                    
                    <p style="color: #94a3b8; font-size: 12px; margin: 15px 0 0 0; line-height: 1.5;">
                      Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.<br>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };
};

// Template email reset password
const resetPasswordEmailTemplate = (name, resetLink) => {
  return {
    subject: "Đặt lại mật khẩu QuizLingo của bạn",
    html: `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Đặt lại mật khẩu QuizLingo</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden; margin: 0 auto;">
                
                <!-- Header với gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                    <div style="font-size: 60px; margin-bottom: 20px;">
                      🔐
                    </div>
                    <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 10px 0; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                      Quizlingo
                    </h1>
                    <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 0; font-weight: 500;">
                      Đặt lại mật khẩu của bạn
                    </p>
                  </td>
                </tr>
                
                <!-- Content chính -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                      Chào ${name}! 👋
                    </h2>
                    
                    <div style="background: #1e293b; padding: 30px; border-radius: 12px; margin: 20px 0; border: 1px solid #475569;">
                      <div style="color: #ffffff; font-size: 16px; line-height: 1.8; font-weight: 500;">
                        Cảm ơn bạn đã đăng ký tài khoản trên QuizLingo. Để hoàn tất quá trình đăng ký, vui lòng xác thực tài khoản của bạn bằng cách nhấp vào nút bên dưới.
                      </div>
                    </div>
                    
                    <!-- Reset warning -->
                    <div style="background: #fef2f2; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center; border: 1px solid #fee2e2;">
                      <div style="font-size: 18px; font-weight: 600; color: #dc2626; margin-bottom: 10px;">
                        ⚠️ Liên kết sẽ hết hạn sau 1 giờ
                      </div>
                      <div style="font-size: 14px; color: #dc2626;">
                        Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này
                      </div>
                    </div>
                    
                    <!-- Call to Action Button -->
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;">
                        🔄 Đặt lại mật khẩu
                      </a>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 14px; margin: 10px 0;">
                      <strong>💫 Quizlingo Team</strong><br>
                      Cùng bạn chinh phục tiếng Anh mỗi ngày!
                    </p>
                    
                    <p style="color: #94a3b8; font-size: 12px; margin: 15px 0 0 0; line-height: 1.5;">
                      Đây là email đặt lại mật khẩu từ Quizlingo.<br>
                      Mật khẩu của bạn sẽ không thay đổi cho đến khi bạn truy cập liên kết trên.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };
};

export { sendEmail, verificationEmailTemplate, resetPasswordEmailTemplate };
