/**
 * ⚡ PERFORMANCE: Simple in-memory queue for AI generation
 * Để tránh quá tải khi nhiều user cùng lúc request AI generation
 */

class AIGenerationQueue {
    constructor(maxConcurrent = 3) {
        this.maxConcurrent = maxConcurrent;
        this.currentRunning = 0;
        this.queue = [];
        this.stats = {
            totalProcessed: 0,
            totalFailed: 0,
            avgProcessingTime: 0
        };
    }

    /**
     * Add generation task to queue
     * @param {Function} task - Async function to execute
     * @param {string} userId - User ID for tracking
     * @returns {Promise} Task result
     */
    async add(task, userId) {
        return new Promise((resolve, reject) => {
            const queueItem = {
                task,
                userId,
                resolve,
                reject,
                addedAt: Date.now()
            };

            this.queue.push(queueItem);
            console.log(`📋 Added AI generation task for user ${userId} to queue (position: ${this.queue.length})`);

            this.processNext();
        });
    }

    async processNext() {
        if (this.currentRunning >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        const item = this.queue.shift();
        this.currentRunning++;

        const startTime = Date.now();
        console.log(`🚀 Processing AI generation for user ${item.userId} (${this.currentRunning}/${this.maxConcurrent} running)`);

        try {
            const result = await item.task();
            const processingTime = Date.now() - startTime;

            // Update stats
            this.stats.totalProcessed++;
            this.stats.avgProcessingTime = (this.stats.avgProcessingTime + processingTime) / 2;

            console.log(`✅ AI generation completed for user ${item.userId} in ${processingTime}ms`);
            item.resolve(result);

        } catch (error) {
            this.stats.totalFailed++;
            console.error(`❌ AI generation failed for user ${item.userId}:`, error.message);
            item.reject(error);

        } finally {
            this.currentRunning--;

            // Process next item in queue
            setImmediate(() => this.processNext());
        }
    }

    /**
     * Get queue statistics
     */
    getStats() {
        return {
            ...this.stats,
            currentRunning: this.currentRunning,
            queueLength: this.queue.length,
            maxConcurrent: this.maxConcurrent
        };
    }

    /**
     * Clear queue (emergency use)
     */
    clear() {
        this.queue.forEach(item => {
            item.reject(new Error('Queue cleared'));
        });
        this.queue = [];
        console.log('🧹 AI generation queue cleared');
    }
}

// Singleton instance
const aiGenerationQueue = new AIGenerationQueue(3); // Max 3 concurrent AI generations

export default aiGenerationQueue;