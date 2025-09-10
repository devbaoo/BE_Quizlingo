// Simple in-memory cache service for optimization
class CacheService {
    constructor() {
        this.cache = new Map();
        this.ttl = new Map(); // Time to live
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes default

        // Cleanup expired items every minute
        setInterval(() => this.cleanup(), 60000);
    }

    set(key, value, ttl = this.defaultTTL) {
        this.cache.set(key, value);
        this.ttl.set(key, Date.now() + ttl);
        console.log(`💾 Cached: ${key} (TTL: ${ttl}ms)`);
    }

    get(key) {
        // Check if expired
        if (this.isExpired(key)) {
            this.delete(key);
            return null;
        }

        const value = this.cache.get(key);
        if (value) {
            console.log(`🎯 Cache hit: ${key}`);
        } else {
            console.log(`❌ Cache miss: ${key}`);
        }
        return value;
    }

    delete(key) {
        this.cache.delete(key);
        this.ttl.delete(key);
        console.log(`🗑️ Deleted from cache: ${key}`);
    }

    isExpired(key) {
        const expiry = this.ttl.get(key);
        return expiry && Date.now() > expiry;
    }

    cleanup() {
        let cleaned = 0;
        for (const [key, expiry] of this.ttl.entries()) {
            if (Date.now() > expiry) {
                this.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired cache items`);
        }
    }

    clear() {
        this.cache.clear();
        this.ttl.clear();
        console.log('🧽 Cache cleared');
    }

    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    // Specialized methods for common cached items

    async getOrSetMarxistTopics(fetchFunction) {
        const key = 'marxist_topics_active';
        let topics = this.get(key);

        if (!topics) {
            topics = await fetchFunction();
            this.set(key, topics, 10 * 60 * 1000); // Cache for 10 minutes
        }

        return topics;
    }

    async getOrSetTopicById(topicId, fetchFunction) {
        const key = `topic_${topicId}`;
        let topic = this.get(key);

        if (!topic) {
            topic = await fetchFunction(topicId);
            if (topic) {
                this.set(key, topic, 15 * 60 * 1000); // Cache for 15 minutes
            }
        }

        return topic;
    }

    async getOrSetLevel(levelName, fetchFunction) {
        const key = `level_${levelName}`;
        let level = this.get(key);

        if (!level) {
            level = await fetchFunction(levelName);
            if (level) {
                this.set(key, level, 30 * 60 * 1000); // Cache for 30 minutes
            }
        }

        return level;
    }

    async getOrSetSkill(skillName, fetchFunction) {
        const key = `skill_${skillName}`;
        let skill = this.get(key);

        if (!skill) {
            skill = await fetchFunction(skillName);
            if (skill) {
                this.set(key, skill, 30 * 60 * 1000); // Cache for 30 minutes
            }
        }

        return skill;
    }

    // Cache user progress analysis (short TTL since it changes frequently)
    async getOrSetUserProgress(userId, fetchFunction) {
        const key = `user_progress_${userId}`;
        let progress = this.get(key);

        if (!progress) {
            progress = await fetchFunction(userId);
            this.set(key, progress, 2 * 60 * 1000); // Cache for 2 minutes only
        }

        return progress;
    }

    // Invalidate user-specific cache when user completes a lesson
    invalidateUserCache(userId) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.includes(`user_${userId}`) || key.includes(`progress_${userId}`)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.delete(key));
        console.log(`🔄 Invalidated ${keysToDelete.length} cache items for user ${userId}`);
    }
}

// Singleton instance
const cacheService = new CacheService();

export default cacheService;
