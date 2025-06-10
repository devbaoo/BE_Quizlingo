import rateLimit from "express-rate-limit";

let forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5, // Tối đa 5 lần / IP / 15 phút
    message: {
        success: false,
        statusCode: 429,
        message: "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.",
    },
});

export default forgotPasswordLimiter;