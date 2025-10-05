import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import jwtConfig from "../config/jwtConfig.js";
import emailService from "./emailService.js";
import moment from "moment-timezone";

const verifyRecaptcha = async (token) => {
  // 🧩 Dùng key demo của Google để test
  const secret = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${secret}&response=${token}`,
  });

  const data = await response.json();
  return data.success && (data.score ?? 1) >= 0.5;
};

const register = async (userData, baseUrl) => {
  const { firstName, lastName, email, password, recaptchaToken } = userData;

  // Check reCAPTCHA
  const recaptchaPassed = await verifyRecaptcha(recaptchaToken);
  if (!recaptchaPassed) {
    return {
      success: false,
      statusCode: 403,
      message: "Xác minh reCAPTCHA thất bại. Vui lòng thử lại.",
    };
  }

  // Check existing email
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return {
      success: false,
      statusCode: 400,
      message: "Email đã được đăng ký",
    };
  }

  // Check email domain
  const allowedDomains = ["gmail.com", "yahoo.com", "outlook.com", "fpt.edu.vn"];
  const domain = email.split("@")[1];
  if (!allowedDomains.includes(domain)) {
    return {
      success: false,
      statusCode: 400,
      message: "Email không hợp lệ hoặc không được hỗ trợ",
    };
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create new user (chưa lưu)
  const user = new User({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    isVerify: false,
  });

  // Validate trước khi gửi email
  await user.validate();

  // Gửi email xác thực
  if (baseUrl) {
    const emailResult = await emailService.sendVerificationEmail(user, baseUrl);
    if (!emailResult.success) {
      return {
        success: false,
        statusCode: 500,
        message: "Không thể gửi email xác thực",
      };
    }
  }

  // Lưu vào DB sau khi email gửi thành công
  await user.save();

  const { accessToken, refreshToken } = generateToken(user);

  return {
    success: true,
    statusCode: 201,
    message: "Đăng ký thành công. Vui lòng xác thực tài khoản qua email.",
    accessToken,
    refreshToken,
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
  let user = await User.findOne({ email }).populate("level", "name");

  if (!user) {
    return {
      success: false,
      statusCode: 400,
      message: "Thông tin đăng nhập không hợp lệ",
    };
  }

  let isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return {
      success: false,
      statusCode: 400,
      message: "Thông tin đăng nhập không hợp lệ",
    };
  }

  // Streak logic implementation with Vietnam timezone
  const now = moment().tz("Asia/Ho_Chi_Minh");
  const today = now.clone().startOf("day");

  if (user.lastLoginDate) {
    const lastLogin = moment(user.lastLoginDate)
      .tz("Asia/Ho_Chi_Minh")
      .startOf("day");

    // Calculate the difference in days
    const dayDiff = today.diff(lastLogin, "days");

    if (dayDiff === 1) {
      // User logged in the next day - increase streak
      user.streak += 1;
    } else if (dayDiff > 1) {
      // User missed login for more than 1 day - reset streak
      user.streak = 1;
    }
    // If dayDiff === 0, user already logged in today, don't change streak
  } else {
    // First login ever
    user.streak = 1;
  }

  // Update last login date to current Vietnam time
  user.lastLoginDate = now.toDate();
  await user.save();

  let { accessToken, refreshToken } = generateToken(user);

  return {
    success: true,
    statusCode: 200,
    message: "Đăng nhập thành công",
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isVerify: user.isVerify,
      avatar: user.avatar,
      streak: user.streak,
      lives: user.lives,
      xp: user.xp,
      userLevel: user.userLevel,
      level: user.level ? user.level.name : null,
    },
    needVerification: !user.isVerify,
  };
};

let generateToken = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.expiresIn,
    }
  );

  const refreshToken = jwt.sign({ id: user._id }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  });

  return { accessToken, refreshToken };
};

const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Giả sử jwtConfig.secret là process.env.JWT_SECRET
    if (!decoded.id) {
      return {
        success: false,
        statusCode: 401,
        message: "Token không chứa ID người dùng",
      };
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return {
        success: false,
        statusCode: 401,
        message: "Không tìm thấy người dùng",
      };
    }

    return {
      success: true,
      statusCode: 200,
      user: {
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        level: user.level,
        userLevel: user.userLevel,
      },
    };
  } catch (error) {
    console.error("Verify token error:", error);
    return {
      success: false,
      statusCode: 401,
      message: "Token không hợp lệ hoặc đã hết hạn",
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
        message: "Không tìm thấy người dùng",
      };
    }

    if (user.isVerify) {
      return {
        success: false,
        statusCode: 400,
        message: "Người dùng đã được xác thực",
      };
    }

    const emailResult = await emailService.sendVerificationEmail(user, baseUrl);

    if (!emailResult.success) {
      return {
        success: false,
        statusCode: 500,
        message: "Không thể gửi email xác thực",
        error: emailResult.error,
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Đã gửi email xác thực thành công",
    };
  } catch (error) {
    console.error("Resend verification error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi máy chủ",
      error: error.message,
    };
  }
};

// Khởi tạo quá trình reset password
const forgotPassword = async (email, baseUrl, recaptchaToken) => {
  try {
    // 1. Verify reCAPTCHA
    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) {
      return {
        success: false,
        statusCode: 403,
        message: "Xác minh reCAPTCHA thất bại. Vui lòng thử lại.",
      };
    }

    // 2. Tìm user (nếu tồn tại) nhưng KHÔNG phản hồi cho client biết
    const user = await User.findOne({ email });

    if (user) {
      // 3. Kiểm tra cooldown 5 phút giữa các lần gửi
      const now = new Date();
      const lastSent = user.lastResetEmailSentAt || new Date(0);
      const minutesSinceLast = (now - lastSent) / (1000 * 60);

      if (minutesSinceLast < 5) {
        return {
          success: true,
          statusCode: 200,
          message: "Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.",
        };
      }

      // 4. Gửi email reset password
      const emailResult = await emailService.sendResetPasswordEmail(user, baseUrl);
      if (emailResult.success) {
        // Cập nhật thời gian gửi gần nhất
        user.lastResetEmailSentAt = now;
        await user.save();
      }
    }

    // 5. Phản hồi luôn giống nhau (ngay cả khi user không tồn tại)
    return {
      success: true,
      statusCode: 200,
      message: "Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.",
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

const changePassword = async (userId, oldPassword, newPassword) => {
  try {
    if (!oldPassword || !newPassword) {
      return {
        success: false,
        statusCode: 400,
        message: "Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới",
      };
    }

    if (newPassword.length < 6) {
      return {
        success: false,
        statusCode: 400,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) {
      return {
        success: false,
        statusCode: 400,
        message: "Mật khẩu cũ không chính xác",
      };
    }

    if (oldPassword === newPassword) {
      return {
        success: false,
        statusCode: 400,
        message: "Mật khẩu mới không được trùng với mật khẩu cũ",
      };
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "Mật khẩu đã được thay đổi thành công",
    };
  } catch (error) {
    console.error("Change password error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi thay đổi mật khẩu",
      error: error.message,
    };
  }
};

const refreshToken = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);

    // Find user
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    // Generate new tokens
    const tokens = generateToken(user);

    return {
      success: true,
      statusCode: 200,
      message: "Làm mới token thành công",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch (error) {
    console.error("Refresh token error:", error);
    return {
      success: false,
      statusCode: 401,
      message: "Refresh token không hợp lệ hoặc đã hết hạn",
    };
  }
};

// Đăng nhập Google với dữ liệu user từ frontend
const googleLogin = async (userData) => {
  try {
    const { email, name, picture } = userData;

    if (!email) {
      return {
        success: false,
        statusCode: 400,
        message: "Không lấy được email từ Google",
      };
    }

    // Tìm user theo email
    let user = await User.findOne({ email }).populate("level", "name");
    if (!user) {
      // Nếu chưa có user, tạo mới
      const [firstName, ...lastNameArr] = name ? name.split(" ") : ["", ""];
      const lastName = lastNameArr.join(" ");

      // Tạo một password hash ngẫu nhiên cho Google user
      const salt = await bcrypt.genSalt(10);
      const randomPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = new User({
        firstName: firstName || "Google",
        lastName: lastName || "User",
        email,
        password: hashedPassword,
        isVerify: true,
        avatar: picture || "",
      });
      await user.save();

      // Populate level after saving
      user = await User.findById(user._id).populate("level", "name");
    }

    // Cập nhật streak logic tương tự như login thường
    const now = moment().tz("Asia/Ho_Chi_Minh");
    const today = now.clone().startOf("day");

    if (user.lastLoginDate) {
      const lastLogin = moment(user.lastLoginDate)
        .tz("Asia/Ho_Chi_Minh")
        .startOf("day");

      const dayDiff = today.diff(lastLogin, "days");

      if (dayDiff === 1) {
        user.streak += 1;
      } else if (dayDiff > 1) {
        user.streak = 1;
      }
    } else {
      user.streak = 1;
    }

    user.lastLoginDate = now.toDate();
    await user.save();

    // Đăng nhập thành công, tạo token
    let { accessToken, refreshToken } = generateToken(user);
    return {
      success: true,
      statusCode: 200,
      message: "Đăng nhập Google thành công",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerify: user.isVerify,
        avatar: user.avatar,
        streak: user.streak,
        lives: user.lives,
        xp: user.xp,
        userLevel: user.userLevel,
        level: user.level ? user.level.name : null,
      },
      needVerification: false,
    };
  } catch (error) {
    console.error("Google login error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi server khi đăng nhập Google",
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
  changePassword,
  refreshToken,
  googleLogin,
};
