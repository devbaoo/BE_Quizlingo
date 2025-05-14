import crypto from "crypto";
import { sendEmail, verificationEmailTemplate } from "../config/emailConfig.js";
import Token from "../models/token.js";
import User from "../models/user.js";

// Tạo token xác thực
const generateVerificationToken = async (userId) => {
  // Tạo token ngẫu nhiên
  const token = crypto.randomBytes(32).toString("hex");

  // Lưu token vào database
  await Token.create({
    userId,
    token,
    type: "verification",
  });

  return token;
};

// Gửi email xác thực tài khoản
const sendVerificationEmail = async (user, baseUrl) => {
  try {
    // Tạo token xác thực
    const token = await generateVerificationToken(user._id);

    // Tạo link xác thực
    const verificationLink = `${baseUrl}/api/auth/verify-email/${token}`;

    // Thiết lập thông tin email
    const emailContent = verificationEmailTemplate(
      user.firstName,
      verificationLink
    );

    // Thông tin người nhận
    const mailOptions = {
      from: `"QuizLingo" <${process.env.EMAIL_USER || "verify@quizlingo.com"}>`,
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
    };

    // Gửi email
    await sendEmail(mailOptions);

    return {
      success: true,
      message: "Email xác thực đã được gửi",
    };
  } catch (error) {
    console.error("Send verification email error:", error);
    return {
      success: false,
      message: "Không thể gửi email xác thực",
      error: error.message,
    };
  }
};

// Xác thực email bằng token
const verifyEmail = async (token) => {
  try {
    // Tìm token trong database
    const verificationToken = await Token.findOne({
      token,
      type: "verification",
    });

    if (!verificationToken) {
      return {
        success: false,
        statusCode: 400,
        message: "Token không hợp lệ hoặc đã hết hạn",
      };
    }

    // Cập nhật trạng thái xác thực của người dùng
    const user = await User.findByIdAndUpdate(
      verificationToken.userId,
      { isVerify: true },
      { new: true }
    );

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    // Xóa token sau khi đã sử dụng
    await Token.findByIdAndDelete(verificationToken._id);

    return {
      success: true,
      statusCode: 200,
      message: "Xác thực email thành công",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isVerify: user.isVerify,
      },
    };
  } catch (error) {
    console.error("Verify email error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi hệ thống",
      error: error.message,
    };
  }
};

export default {
  sendVerificationEmail,
  verifyEmail,
};
