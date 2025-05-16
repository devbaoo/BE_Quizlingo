import crypto from "crypto";
import {
  sendEmail,
  verificationEmailTemplate,
  resetPasswordEmailTemplate,
} from "../config/emailConfig.js";
import Token from "../models/token.js";
import User from "../models/user.js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

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

    const frontendUrl = process.env.FRONTEND_URL || baseUrl;

    // Tạo link xác thực
    const verificationLink = `${frontendUrl}/verify-email/${token}`;

    // Thiết lập thông tin email
    const emailContent = verificationEmailTemplate(
      user.firstName,
      verificationLink
    );

    // Thông tin người nhận
    const mailOptions = {
      from: `"QuizLingo" <${process.env.EMAIL_USER}>`,
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

// Tạo token reset password
const generateResetPasswordToken = async (userId) => {
  // Tạo token ngẫu nhiên
  const token = crypto.randomBytes(32).toString("hex");

  // Lưu token vào database với thời hạn 1 giờ
  await Token.create({
    userId,
    token,
    type: "reset-password",
  });

  return token;
};

// Gửi email reset password
const sendResetPasswordEmail = async (user, baseUrl) => {
  try {
    // Tạo token reset password
    const token = await generateResetPasswordToken(user._id);

    const frontendUrl = process.env.FRONTEND_URL || baseUrl;

    // Tạo link reset password
    const resetLink = `${frontendUrl}/reset-password/${token}`;

    // Thiết lập thông tin email
    const emailContent = resetPasswordEmailTemplate(user.firstName, resetLink);

    // Thông tin người nhận
    const mailOptions = {
      from: `"QuizLingo" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
    };

    // Gửi email
    await sendEmail(mailOptions);

    return {
      success: true,
      message: "Email đặt lại mật khẩu đã được gửi",
    };
  } catch (error) {
    console.error("Send reset password email error:", error);
    return {
      success: false,
      message: "Không thể gửi email đặt lại mật khẩu",
      error: error.message,
    };
  }
};

// Xác thực token reset password và cập nhật mật khẩu
const resetPassword = async (token, newPassword) => {
  try {
    // Tìm token trong database
    const resetToken = await Token.findOne({
      token,
      type: "reset-password",
    });

    if (!resetToken) {
      return {
        success: false,
        statusCode: 400,
        message: "Token không hợp lệ hoặc đã hết hạn",
      };
    }

    // Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Cập nhật mật khẩu người dùng
    const user = await User.findByIdAndUpdate(
      resetToken.userId,
      { password: hashedPassword },
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
    await Token.findByIdAndDelete(resetToken._id);

    return {
      success: true,
      statusCode: 200,
      message: "Đặt lại mật khẩu thành công",
    };
  } catch (error) {
    console.error("Reset password error:", error);
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
  sendResetPasswordEmail,
  resetPassword,
};
