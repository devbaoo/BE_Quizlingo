// ULTRA FAST MODE: Tối ưu cho single user testing
const MAX_CONCURRENT_GENERATIONS = 20; // Tăng từ 10 lên 20 cho single user
const MAX_QUEUE_SIZE = 100; // Tăng từ 50 lên 100

class GenerationRateLimiter {
  constructor() {
    this.currentGenerations = new Set();
    this.queue = [];
    this.processing = false;
    // Thêm set để track users đang trong quá trình request (bao gồm queue)
    this.activeUserRequests = new Set();
  }

  async requestGeneration(userId, generationFunction) {
    return new Promise((resolve, reject) => {
      // FORCE CLEANUP: Xóa user cũ nếu bị stuck
      if (this.activeUserRequests.has(userId)) {
        console.warn(`⚠️ User ${userId} was stuck in activeUserRequests, force cleaning...`);
        this.activeUserRequests.delete(userId);
      }

      // KIỂM TRA NGAY LẬP TỨC - user đã có ANY request active không
      if (this.activeUserRequests.has(userId)) {
        reject({
          success: false,
          statusCode: 429,
          message:
            "Bạn đang có yêu cầu tạo bài học đang xử lý. Vui lòng chờ hoàn thành.",
          reason: "USER_REQUEST_IN_PROGRESS",
          suggestedWaitTime: 10000, // ULTRA FAST: Giảm từ 30s xuống 10s
        });
        return;
      }

      // KHÓA USER NGAY LẬP TỨC để tránh duplicate requests
      this.activeUserRequests.add(userId);

      // Kiểm tra queue size
      if (this.queue.length >= MAX_QUEUE_SIZE) {
        this.activeUserRequests.delete(userId); // Unlock nếu queue full
        reject({
          success: false,
          statusCode: 503,
          message: "Hệ thống đang quá tải. Vui lòng thử lại sau.",
          queueSize: this.queue.length,
          maxQueueSize: MAX_QUEUE_SIZE,
        });
        return;
      }

      // Thêm vào queue với wrapped resolve/reject để unlock user
      const wrappedResolve = (result) => {
        this.activeUserRequests.delete(userId);
        resolve(result);
      };

      const wrappedReject = (error) => {
        this.activeUserRequests.delete(userId);
        reject(error);
      };

      this.queue.push({
        userId,
        generationFunction,
        resolve: wrappedResolve,
        reject: wrappedReject,
        timestamp: Date.now(),
      });

      console.log(
        `📥 Added user ${userId} to generation queue. Queue size: ${this.queue.length}`
      );

      // Bắt đầu xử lý queue
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (
      this.queue.length > 0 &&
      this.currentGenerations.size < MAX_CONCURRENT_GENERATIONS
    ) {
      const request = this.queue.shift();

      // Kiểm tra timeout (5 phút)
      if (Date.now() - request.timestamp > 5 * 60 * 1000) {
        request.reject({
          success: false,
          statusCode: 408,
          message: "Request timeout. Vui lòng thử lại.",
          reason: "QUEUE_TIMEOUT",
        });
        continue;
      }

      // Vì đã có activeUserRequests lock, không cần check currentGenerations nữa
      // Chỉ cần thêm vào currentGenerations khi bắt đầu xử lý
      this.currentGenerations.add(request.userId);

      console.log(
        `🚀 Starting generation for user ${request.userId}. Active: ${this.currentGenerations.size}/${MAX_CONCURRENT_GENERATIONS}`
      );

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
        message: "Lỗi khi tạo bài học. Vui lòng thử lại.",
        error: error.message,
      });
    } finally {
      // Xóa khỏi current generations
      this.currentGenerations.delete(request.userId);
      console.log(
        `✅ Completed generation for user ${request.userId}. Active: ${this.currentGenerations.size}/${MAX_CONCURRENT_GENERATIONS}`
      );

      // Tiếp tục xử lý queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  // Clear stuck generation for specific user
  clearUserGeneration(userId) {
    const wasGenerating = this.currentGenerations.has(userId);
    const wasLocked = this.activeUserRequests.has(userId);

    this.currentGenerations.delete(userId);
    this.activeUserRequests.delete(userId);

    console.log(
      `🧹 Manually cleared stuck generation for user ${userId} (generating: ${wasGenerating}, locked: ${wasLocked})`
    );
    return { wasGenerating, wasLocked };
  }

  // Clear all stuck generations (for admin use)
  clearAllGenerations() {
    const count = this.currentGenerations.size;
    const lockedCount = this.activeUserRequests.size;
    this.currentGenerations.clear();
    this.activeUserRequests.clear();
    console.log(
      `🧹 Manually cleared ${count} stuck generations and ${lockedCount} locked users`
    );
    return { cleared: count, unlockedUsers: lockedCount };
  }

  getStats() {
    return {
      currentGenerations: this.currentGenerations.size,
      activeUserRequests: this.activeUserRequests.size,
      maxConcurrent: MAX_CONCURRENT_GENERATIONS,
      queueSize: this.queue.length,
      maxQueueSize: MAX_QUEUE_SIZE,
      activeUsers: Array.from(this.currentGenerations),
      lockedUsers: Array.from(this.activeUserRequests),
    };
  }

  // Cleanup expired queue items
  cleanupQueue() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    const originalLength = this.queue.length;
    this.queue = this.queue.filter((item) => {
      const expired = now - item.timestamp > timeout;
      if (expired) {
        item.reject({
          success: false,
          statusCode: 408,
          message: "Request timeout. Vui lòng thử lại.",
          reason: "CLEANUP_TIMEOUT",
        });
      }
      return !expired;
    });

    if (this.queue.length !== originalLength) {
      console.log(
        `🧹 Cleaned up ${originalLength - this.queue.length
        } expired queue items`
      );
    }
  }

  // Force clear stuck user
  forceCleanupUser(userId) {
    const wasStuck = this.activeUserRequests.has(userId);
    this.activeUserRequests.delete(userId);
    console.log(`🧹 Force cleanup user ${userId}: ${wasStuck ? 'was stuck' : 'was clean'}`);
    return wasStuck;
  }

  // Clear all stuck users
  forceCleanupAllUsers() {
    const count = this.activeUserRequests.size;
    this.activeUserRequests.clear();
    console.log(`🧹 Force cleanup ${count} stuck users`);
    return count;
  }
}

// Singleton instance
const generationRateLimiter = new GenerationRateLimiter();

// Cleanup expired items every minute
setInterval(() => {
  generationRateLimiter.cleanupQueue();
}, 60000);

export default generationRateLimiter;
