import rateLimit from "express-rate-limit";

let loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 phút
    max: 5, // tối đa 5 lần / IP
    message: {
        success: false,
        statusCode: 429,
        message: "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.",
    },
});

export default loginLimiter;
