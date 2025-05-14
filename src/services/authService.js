import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import jwtConfig from "../config/jwtConfig.js";
import emailService from "./emailService.js";

let register = async (userData, baseUrl) => {
  let { firstName, lastName, email, password } = userData;

  let existingUser = await User.findOne({ email });
  if (existingUser) {
    return {
      success: false,
      statusCode: 400,
      message: "Email already registered",
    };
  }

  let salt = await bcrypt.genSalt(10);
  let hashedPassword = await bcrypt.hash(password, salt);

  // Create new user
  let user = new User({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    isVerify: false,
  });

  await user.save();

  // Gửi email xác thực
  if (baseUrl) {
    const emailResult = await emailService.sendVerificationEmail(user, baseUrl);
    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
    }
  }

  let token = generateToken(user);

  return {
    success: true,
    statusCode: 201,
    message:
      "User registered successfully. Please verify your account when convenient.",
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isVerify: user.isVerify,
    },
  };
};

let login = async (email, password) => {
  let user = await User.findOne({ email });

  if (!user) {
    return {
      success: false,
      statusCode: 400,
      message: "Invalid credentials",
    };
  }

  let isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return {
      success: false,
      statusCode: 400,
      message: "Invalid credentials",
    };
  }

  let token = generateToken(user);

  return {
    success: true,
    statusCode: 200,
    message: "Login successful",
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isVerify: user.isVerify,
    },
    needVerification: !user.isVerify,
  };
};

let generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });
};

let verifyToken = async (token) => {
  try {
    let decoded = jwt.verify(token, jwtConfig.secret);
    let user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return {
        success: false,
        statusCode: 401,
        message: "User not found",
      };
    }

    return {
      success: true,
      user,
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 401,
      message: "Invalid token",
    };
  }
};

// Verify user email
const verifyEmailToken = async (token, returnUrl) => {
  const result = await emailService.verifyEmail(token);

  if (result.success && returnUrl) {
    result.returnUrl = returnUrl;
  }

  return result;
};

// Resend verification email
const resendVerificationEmail = async (email, baseUrl) => {
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "User not found",
      };
    }

    if (user.isVerify) {
      return {
        success: false,
        statusCode: 400,
        message: "User already verified",
      };
    }

    const emailResult = await emailService.sendVerificationEmail(user, baseUrl);

    if (!emailResult.success) {
      return {
        success: false,
        statusCode: 500,
        message: "Failed to send verification email",
        error: emailResult.error,
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Verification email sent successfully",
    };
  } catch (error) {
    console.error("Resend verification error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Server error",
      error: error.message,
    };
  }
};

// Khởi tạo quá trình reset password
const forgotPassword = async (email, baseUrl) => {
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy tài khoản với email này",
      };
    }

    const emailResult = await emailService.sendResetPasswordEmail(
      user,
      baseUrl
    );

    if (!emailResult.success) {
      return {
        success: false,
        statusCode: 500,
        message: "Không thể gửi email đặt lại mật khẩu",
        error: emailResult.error,
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Email đặt lại mật khẩu đã được gửi",
    };
  } catch (error) {
    console.error("Forgot password error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi hệ thống",
      error: error.message,
    };
  }
};

// Thực hiện reset password
const resetPasswordWithToken = async (token, newPassword) => {
  try {
    // Kiểm tra độ mạnh của mật khẩu (tùy chọn)
    if (newPassword.length < 6) {
      return {
        success: false,
        statusCode: 400,
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      };
    }

    const result = await emailService.resetPassword(token, newPassword);
    return result;
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
  register,
  login,
  generateToken,
  verifyToken,
  verifyEmailToken,
  resendVerificationEmail,
  forgotPassword,
  resetPasswordWithToken,
};
