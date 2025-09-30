import geminiService from './geminiService.js';
import grokService from './grokService.js';

// Multi-AI Load Balancer Configuration
const AI_PROVIDERS = [
    {
        name: 'grok',
        service: grokService,
        priority: 1,
        weight: 70, // 70% traffic (Grok4 is primary AI)
        maxConcurrent: 10, // ⚡ Increase concurrent for better performance
        rateLimit: {
            free: { requestsPerMinute: 60, requestsPerSecond: 2 }, // ⚡ More aggressive for speed
            paid: { requestsPerMinute: 300, requestsPerSecond: 15 }
        }
    },
    {
        name: 'gemini',
        service: geminiService,
        priority: 2,
        weight: 30, // 30% traffic (Gemini is backup AI)  
        maxConcurrent: 15, // ⚡ Increase concurrent
        rateLimit: {
            free: { requestsPerMinute: 30, requestsPerSecond: 2 }, // ⚡ More aggressive
            paid: { requestsPerMinute: 400, requestsPerSecond: 25 }
        }
    }
];

class MultiAiLoadBalancer {
    constructor() {
        this.currentLoads = new Map();
        this.failureCount = new Map();
        this.lastUsed = new Map();

        // Initialize tracking
        AI_PROVIDERS.forEach(provider => {
            this.currentLoads.set(provider.name, 0);
            this.failureCount.set(provider.name, 0);
            this.lastUsed.set(provider.name, 0);
        });

        // Reset failure counts every 5 minutes
        setInterval(() => this.resetFailureCounts(), 5 * 60 * 1000);
    }

    /**
     * Select best AI provider based on load balancing strategy
     * @param {string} strategy - 'round_robin', 'least_loaded', 'weighted', 'failover'
     * @returns {Object} Selected provider
     */
    selectProvider(strategy = 'weighted') {
        const availableProviders = AI_PROVIDERS.filter(provider => {
            const failures = this.failureCount.get(provider.name);
            const currentLoad = this.currentLoads.get(provider.name);

            // Skip if too many failures (circuit breaker)
            if (failures >= 3) {
                console.log(`🚫 Provider ${provider.name} circuit breaker activated (${failures} failures)`);
                return false;
            }

            // Skip if at max concurrent
            if (currentLoad >= provider.maxConcurrent) {
                console.log(`⚠️ Provider ${provider.name} at max concurrent (${currentLoad}/${provider.maxConcurrent})`);
                return false;
            }

            return true;
        });

        if (availableProviders.length === 0) {
            console.error('❌ No available AI providers! Using fallback...');
            return AI_PROVIDERS[0]; // Fallback to first provider
        }

        let selectedProvider;

        switch (strategy) {
            case 'round_robin':
                selectedProvider = this.selectRoundRobin(availableProviders);
                break;
            case 'least_loaded':
                selectedProvider = this.selectLeastLoaded(availableProviders);
                break;
            case 'failover':
                selectedProvider = this.selectFailover(availableProviders);
                break;
            case 'weighted':
            default:
                selectedProvider = this.selectWeighted(availableProviders);
                break;
        }

        console.log(`🎯 Selected AI provider: ${selectedProvider.name} (${strategy} strategy)`);
        return selectedProvider;
    }

    selectRoundRobin(providers) {
        // Find provider used longest ago
        return providers.reduce((selected, current) => {
            const selectedLastUsed = this.lastUsed.get(selected.name);
            const currentLastUsed = this.lastUsed.get(current.name);
            return currentLastUsed < selectedLastUsed ? current : selected;
        });
    }

    selectLeastLoaded(providers) {
        return providers.reduce((selected, current) => {
            const selectedLoad = this.currentLoads.get(selected.name);
            const currentLoad = this.currentLoads.get(current.name);
            return currentLoad < selectedLoad ? current : selected;
        });
    }

    selectWeighted(providers) {
        // Calculate weighted random selection
        const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;

        for (const provider of providers) {
            random -= provider.weight;
            if (random <= 0) {
                return provider;
            }
        }

        return providers[0]; // Fallback
    }

    selectFailover(providers) {
        // Select by priority (lowest number = highest priority)
        return providers.sort((a, b) => a.priority - b.priority)[0];
    }

    /**
     * Generate content using load balanced AI providers
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Generation options
     * @returns {Object} Response with generated content
     */
    async generateContent(prompt, options = {}) {
        const strategy = options.strategy || 'weighted';
        const maxProviderRetries = options.maxProviderRetries || 2;

        let lastError = null;
        let attemptedProviders = new Set();

        // Try up to 2 different providers
        for (let providerAttempt = 1; providerAttempt <= maxProviderRetries; providerAttempt++) {
            const provider = this.selectProvider(strategy);

            // Skip if we already tried this provider
            if (attemptedProviders.has(provider.name)) {
                console.log(`⏭️ Skipping ${provider.name}, already attempted`);
                continue;
            }

            attemptedProviders.add(provider.name);

            // Track usage
            this.incrementLoad(provider.name);
            this.lastUsed.set(provider.name, Date.now());

            try {
                console.log(`🚀 Attempting generation with ${provider.name} (attempt ${providerAttempt}/${maxProviderRetries})`);

                const result = await provider.service.generateContent(prompt, options.maxRetries || 3);

                if (result.success) {
                    console.log(`✅ Successfully generated content with ${provider.name}`);

                    // Reset failure count on success
                    this.failureCount.set(provider.name, 0);

                    return {
                        ...result,
                        provider: provider.name,
                        loadBalancer: {
                            strategy,
                            providerAttempt,
                            totalProviders: attemptedProviders.size,
                            currentLoads: Object.fromEntries(this.currentLoads)
                        }
                    };
                } else {
                    console.warn(`⚠️ ${provider.name} failed:`, result.message);
                    this.incrementFailure(provider.name);
                    lastError = result;
                }

            } catch (error) {
                console.error(`❌ ${provider.name} error:`, error.message);
                this.incrementFailure(provider.name);
                lastError = { success: false, message: error.message, provider: provider.name };
            } finally {
                // Always decrement load
                this.decrementLoad(provider.name);
            }
        }

        // All providers failed
        console.error('❌ All AI providers failed!');
        return {
            success: false,
            message: 'All AI providers failed',
            error: lastError,
            loadBalancer: {
                strategy,
                attemptedProviders: Array.from(attemptedProviders),
                totalAttempts: maxProviderRetries,
                currentLoads: Object.fromEntries(this.currentLoads),
                failureCounts: Object.fromEntries(this.failureCount)
            }
        };
    }

    /**
     * Generate JSON content using load balanced AI providers
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Generation options
     * @returns {Object} Response with parsed JSON content
     */
    async generateJsonContent(prompt, options = {}) {
        const strategy = options.strategy || 'weighted';
        const maxProviderRetries = options.maxProviderRetries || 2;
        const baseDelay = options.baseDelay || 1000; // Base delay for exponential backoff

        let lastError = null;
        let attemptedProviders = new Set();

        for (let providerAttempt = 1; providerAttempt <= maxProviderRetries; providerAttempt++) {
            const provider = this.selectProvider(strategy);

            if (attemptedProviders.has(provider.name)) {
                continue;
            }

            attemptedProviders.add(provider.name);
            this.incrementLoad(provider.name);
            this.lastUsed.set(provider.name, Date.now());

            try {
                console.log(`🚀 Attempting JSON generation with ${provider.name}`);

                const result = await provider.service.generateJsonContent(prompt);

                // Normalize result: accept either plain JSON object or { success, data }
                const isWrapped = result && typeof result === 'object' && ('success' in result || 'data' in result);
                const data = isWrapped ? (result.data ?? result.content ?? result.result) : result;

                if (!data) {
                    const message = (isWrapped && result && result.message) ? result.message : 'Empty data returned';
                    console.warn(`⚠️ ${provider.name} JSON failed:`, message);
                    this.incrementFailure(provider.name);
                    lastError = { success: false, message, provider: provider.name };
                } else {
                    console.log(`✅ Successfully generated JSON with ${provider.name}`);
                    this.failureCount.set(provider.name, 0);

                    return {
                        success: true,
                        data,
                        provider: provider.name,
                        loadBalancer: {
                            strategy,
                            providerAttempt,
                            totalProviders: attemptedProviders.size
                        }
                    };
                }

            } catch (error) {
                console.error(`❌ ${provider.name} JSON error:`, error.message);
                this.incrementFailure(provider.name);
                lastError = { success: false, message: error.message, provider: provider.name };

                // Handle rate limiting with exponential backoff
                if (error.message.includes('429') || error.message.includes('rate limit')) {
                    const backoffDelay = baseDelay * Math.pow(2, providerAttempt - 1);
                    console.log(`⏳ Rate limited by ${provider.name}, waiting ${backoffDelay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }
            } finally {
                this.decrementLoad(provider.name);
            }
        }

        return {
            success: false,
            message: 'All AI providers failed for JSON generation',
            error: lastError,
            loadBalancer: {
                strategy,
                attemptedProviders: Array.from(attemptedProviders),
                totalAttempts: maxProviderRetries
            }
        };
    }

    /**
     * Test connections to all AI providers
     * @returns {Object} Connection test results
     */
    async testAllConnections() {
        console.log('🔍 Testing all AI provider connections...');

        const results = {};

        for (const provider of AI_PROVIDERS) {
            try {
                console.log(`Testing ${provider.name}...`);
                const result = await provider.service.validateConnection();
                results[provider.name] = result;
            } catch (error) {
                results[provider.name] = {
                    success: false,
                    connected: false,
                    message: `Connection test failed: ${error.message}`,
                    error: error.message
                };
            }
        }

        const connectedCount = Object.values(results).filter(r => r.success).length;

        return {
            success: connectedCount > 0,
            message: `${connectedCount}/${AI_PROVIDERS.length} AI providers connected`,
            results,
            summary: {
                total: AI_PROVIDERS.length,
                connected: connectedCount,
                failed: AI_PROVIDERS.length - connectedCount
            }
        };
    }

    // Helper methods
    incrementLoad(providerName) {
        const current = this.currentLoads.get(providerName) || 0;
        this.currentLoads.set(providerName, current + 1);
    }

    decrementLoad(providerName) {
        const current = this.currentLoads.get(providerName) || 0;
        this.currentLoads.set(providerName, Math.max(0, current - 1));
    }

    incrementFailure(providerName) {
        const current = this.failureCount.get(providerName) || 0;
        this.failureCount.set(providerName, current + 1);
    }

    resetFailureCounts() {
        console.log('🔄 Resetting AI provider failure counts');
        AI_PROVIDERS.forEach(provider => {
            this.failureCount.set(provider.name, 0);
        });
    }

    getStats() {
        return {
            providers: AI_PROVIDERS.map(p => ({
                name: p.name,
                priority: p.priority,
                weight: p.weight,
                maxConcurrent: p.maxConcurrent,
                currentLoad: this.currentLoads.get(p.name),
                failures: this.failureCount.get(p.name),
                lastUsed: this.lastUsed.get(p.name)
            })),
            timestamp: Date.now()
        };
    }
}

// Singleton instance
const multiAiLoadBalancer = new MultiAiLoadBalancer();

export default multiAiLoadBalancer;
