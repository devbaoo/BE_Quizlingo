import authService from "../services/authService.js";

// Đăng ký tài khoản mới
const register = async (req, res) => {
  try {
    // Lấy hostname và protocol để tạo URL gốc cho email xác thực
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const result = await authService.register(req.body, baseUrl);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Đăng nhập
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      needVerification: result.needVerification || false,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Xác thực email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    // Lấy returnUrl từ query string (do frontend gửi)
    const { returnUrl } = req.query;

    const result = await authService.verifyEmailToken(token, returnUrl);

    if (!result.success) {
      return res.status(result.statusCode).json({
        success: false,
        message: result.message,
      });
    }

    // Nếu yêu cầu API JSON, trả về JSON
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(result.statusCode).json({
        success: true,
        message: result.message,
        user: result.user,
      });
    }

    // Nếu có returnUrl (từ frontend), chuyển hướng đến đó
    if (result.returnUrl) {
      return res.redirect(result.returnUrl);
    }

    // Fallback nếu không có returnUrl: trả về JSON
    return res.status(result.statusCode).json({
      success: true,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Gửi lại email xác thực
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const result = await authService.resendVerificationEmail(email, baseUrl);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Quên mật khẩu - gửi email reset
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const result = await authService.forgotPassword(email, baseUrl);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Reset mật khẩu với token
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const result = await authService.resetPasswordWithToken(token, password);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;
    const result = await authService.changePassword(
      userId,
      oldPassword,
      newPassword
    );
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token không được cung cấp",
      });
    }

    const result = await authService.refreshToken(refreshToken);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ",
    });
  }
};

export default {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshToken,
};
