import rateLimit from "express-rate-limit";

let registerLimiter = rateLimit({
    windowMs: 150 * 60 * 1000, // 15 phút
    max: 70, // Tối đa 5 lần đăng ký / IP
    message: {
        success: false,
        statusCode: 429,
        message: "Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau.",
    },
});

export default registerLimiter;