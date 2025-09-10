// Rate limiter cho AI lesson generation
const MAX_CONCURRENT_GENERATIONS = 5;
const MAX_QUEUE_SIZE = 20;

class GenerationRateLimiter {
    constructor() {
        this.currentGenerations = new Set();
        this.queue = [];
        this.processing = false;
    }

    async requestGeneration(userId, generationFunction) {
        return new Promise((resolve, reject) => {
            // Kiểm tra queue size
            if (this.queue.length >= MAX_QUEUE_SIZE) {
                reject({
                    success: false,
                    statusCode: 503,
                    message: 'Hệ thống đang quá tải. Vui lòng thử lại sau.',
                    queueSize: this.queue.length,
                    maxQueueSize: MAX_QUEUE_SIZE
                });
                return;
            }

            // Thêm vào queue
            this.queue.push({
                userId,
                generationFunction,
                resolve,
                reject,
                timestamp: Date.now()
            });

            console.log(`📥 Added user ${userId} to generation queue. Queue size: ${this.queue.length}`);

            // Bắt đầu xử lý queue
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0 && this.currentGenerations.size < MAX_CONCURRENT_GENERATIONS) {
            const request = this.queue.shift();

            // Kiểm tra timeout (5 phút)
            if (Date.now() - request.timestamp > 5 * 60 * 1000) {
                request.reject({
                    success: false,
                    statusCode: 408,
                    message: 'Request timeout. Vui lòng thử lại.',
                    reason: 'QUEUE_TIMEOUT'
                });
                continue;
            }

            // Kiểm tra user đã có trong generation set chưa
            if (this.currentGenerations.has(request.userId)) {
                request.reject({
                    success: false,
                    statusCode: 429,
                    message: 'Bạn đang có bài học khác đang được tạo.',
                    reason: 'USER_ALREADY_GENERATING'
                });
                continue;
            }

            // Thêm vào current generations
            this.currentGenerations.add(request.userId);

            console.log(`🚀 Starting generation for user ${request.userId}. Active: ${this.currentGenerations.size}/${MAX_CONCURRENT_GENERATIONS}`);

            // Xử lý async
            this.handleGeneration(request);
        }

        this.processing = false;
    }

    async handleGeneration(request) {
        try {
            const result = await request.generationFunction();
            request.resolve(result);
        } catch (error) {
            console.error(`❌ Generation error for user ${request.userId}:`, error);
            request.reject({
                success: false,
                statusCode: 500,
                message: 'Lỗi khi tạo bài học. Vui lòng thử lại.',
                error: error.message
            });
        } finally {
            // Xóa khỏi current generations
            this.currentGenerations.delete(request.userId);
            console.log(`✅ Completed generation for user ${request.userId}. Active: ${this.currentGenerations.size}/${MAX_CONCURRENT_GENERATIONS}`);

            // Tiếp tục xử lý queue
            setTimeout(() => this.processQueue(), 100);
        }
    }

    getStats() {
        return {
            currentGenerations: this.currentGenerations.size,
            maxConcurrent: MAX_CONCURRENT_GENERATIONS,
            queueSize: this.queue.length,
            maxQueueSize: MAX_QUEUE_SIZE,
            activeUsers: Array.from(this.currentGenerations)
        };
    }

    // Cleanup expired queue items
    cleanupQueue() {
        const now = Date.now();
        const timeout = 5 * 60 * 1000; // 5 minutes

        const originalLength = this.queue.length;
        this.queue = this.queue.filter(item => {
            const expired = now - item.timestamp > timeout;
            if (expired) {
                item.reject({
                    success: false,
                    statusCode: 408,
                    message: 'Request timeout. Vui lòng thử lại.',
                    reason: 'CLEANUP_TIMEOUT'
                });
            }
            return !expired;
        });

        if (this.queue.length !== originalLength) {
            console.log(`🧹 Cleaned up ${originalLength - this.queue.length} expired queue items`);
        }
    }
}

// Singleton instance
const generationRateLimiter = new GenerationRateLimiter();

// Cleanup expired items every minute
setInterval(() => {
    generationRateLimiter.cleanupQueue();
}, 60000);

export default generationRateLimiter;
