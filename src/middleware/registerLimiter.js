import rateLimit from "express-rate-limit";

export const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5, // Tối đa 5 lần đăng ký / IP
    message: {
        success: false,
        statusCode: 429,
        message: "Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau.",
    },
})