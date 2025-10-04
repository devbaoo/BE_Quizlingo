// EXTREME FAST MODE FOR SINGLE USER TESTING
// Set môi trường biến để bypass tất cả validation và optimization tối đa

export default {
    // Timeout settings for better success rate while staying fast
    AI_TIMEOUT: 15000,          // 15s cho AI response (tăng từ 8s)
    OVERALL_TIMEOUT: 60000,     // 60s cho toàn bộ process (tăng từ 20s)

    // Retry settings - chỉ 1 lần thử
    MAX_RETRIES: 1,
    MAX_PROVIDER_RETRIES: 2,    // Tăng từ 1 lên 2 cho ổn định

    // Delay settings - minimal delay
    BASE_DELAY: 200,            // 200ms base delay
    BACKOFF_DELAY: 0,
    PROVIDER_DELAY: 100,        // 100ms giữa providers

    // Validation settings - skip để fast nhưng có basic check
    SKIP_VALIDATION: false,     // Keep basic validation
    SKIP_DISTRIBUTION_CHECK: true,  // Skip distribution check cho tốc độ
    SKIP_QUALITY_CHECK: true,

    // Rate limiter - aggressive
    MAX_CONCURRENT: 30,
    MAX_QUEUE_SIZE: 200,

    // Fast fail settings
    FAIL_FAST: false,           // Cho phép retry
    MINIMAL_LOGGING: false,     // Keep full logging for debugging

    // AI settings
    USE_SHORTEST_PROMPT: true,
    PREFER_CACHED_CONTENT: true
};