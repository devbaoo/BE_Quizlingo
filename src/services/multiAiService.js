import qwenService from "./qwenService.js";


// GROK ONLY - No more Gemini, no more demo lessons
const AI_PROVIDERS = [
  {
    name: "qwen",
    service: qwenService,
    priority: 1,
    weight: 100, // 100% weight for Qwen2.5 as it's the only provider now
    maxConcurrent: 5, // Higher concurrent requests for Qwen2.5
    rateLimit: {
      free: { requestsPerMinute: 30, requestsPerSecond: 2 }, // More generous
      paid: { requestsPerMinute: 150, requestsPerSecond: 8 },
    },
    reliability: 1.0, // Full reliability as it's our only provider

  },
];

class MultiAiLoadBalancer {
  constructor() {
    this.currentLoads = new Map();
    this.failureCount = new Map();
    this.lastUsed = new Map();

    // Initialize tracking
    AI_PROVIDERS.forEach((provider) => {
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
   * @param {Array} providerList - Optional list of providers to select from
   * @returns {Object} Selected provider
   */
  selectProvider(strategy = "weighted", providerList = null) {
    const baseProviders = providerList || AI_PROVIDERS;

    const availableProviders = baseProviders.filter((provider) => {
      const failures = this.failureCount.get(provider.name);
      const currentLoad = this.currentLoads.get(provider.name);

      // DEMO MODE: Very lenient circuit breaker - allow more failures
      if (failures >= 10) { // Increased from 5 to 10
        console.log(
          `🚫 Provider ${provider.name} circuit breaker activated (${failures} failures)`
        );
        return false;
      }

      // Skip if at max concurrent
      if (currentLoad >= provider.maxConcurrent) {
        console.log(
          `⚠️ Provider ${provider.name} at max concurrent (${currentLoad}/${provider.maxConcurrent})`
        );
        return false;
      }

      return true;
    });

    if (availableProviders.length === 0) {
      console.warn("⚠️ No available AI providers! Resetting failure counts...");
      // Reset failure counts để có thể sử dụng lại providers
      this.resetFailureCounts();
      return AI_PROVIDERS[0]; // Fallback to first provider
    }

    let selectedProvider;

    switch (strategy) {
      case "round_robin":
        selectedProvider = this.selectRoundRobin(availableProviders);
        break;
      case "least_loaded":
        selectedProvider = this.selectLeastLoaded(availableProviders);
        break;
      case "failover":
        selectedProvider = this.selectFailover(availableProviders);
        break;
      case "reliability_weighted":
        selectedProvider = this.selectReliabilityWeighted(availableProviders);
        break;
      case "weighted":
      default:
        selectedProvider = this.selectWeighted(availableProviders);
        break;
    }

    console.log(
      `🎯 Selected AI provider: ${selectedProvider.name} (${strategy} strategy)`
    );
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

  selectReliabilityWeighted(providers) {
    // Weight by reliability score and current failure count
    const scoredProviders = providers.map((provider) => {
      const failures = this.failureCount.get(provider.name);
      const adjustedReliability =
        provider.reliability * Math.max(0.1, 1 - failures * 0.1);
      return { provider, score: adjustedReliability };
    });

    // Sort by score and select the best
    scoredProviders.sort((a, b) => b.score - a.score);
    return scoredProviders[0].provider;
  }

  /**
   * Generate content using load balanced AI providers
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Generation options
   * @returns {Object} Response with generated content
   */
  async generateContent(prompt, options = {}) {
    const strategy = options.strategy || "failover"; // Changed to failover for better fallback
    const maxProviderRetries = AI_PROVIDERS.length; // Try all providers

    let lastError = null;
    let attemptedProviders = new Set();

    // Try all available providers
    for (
      let providerAttempt = 1;
      providerAttempt <= maxProviderRetries &&
      attemptedProviders.size < AI_PROVIDERS.length;
      providerAttempt++
    ) {
      // Get available providers that haven't been tried yet
      const availableProviders = AI_PROVIDERS.filter(
        (p) => !attemptedProviders.has(p.name)
      );

      if (availableProviders.length === 0) {
        console.log("🔄 All providers attempted, breaking loop");
        break;
      }

      // Select provider from remaining ones
      const provider =
        strategy === "failover"
          ? this.selectFailover(availableProviders)
          : this.selectProvider(strategy, availableProviders);

      attemptedProviders.add(provider.name);

      // Track usage
      this.incrementLoad(provider.name);
      this.lastUsed.set(provider.name, Date.now());

      try {
        console.log(
          `🚀 Attempting generation with ${provider.name} (attempt ${providerAttempt}/${maxProviderRetries})`
        );

        const result = await provider.service.generateContent(
          prompt,
          options.maxRetries || 3
        );

        if (result.success) {
          console.log(
            `✅ Successfully generated content with ${provider.name}`
          );

          // Reset failure count on success
          this.failureCount.set(provider.name, 0);

          return {
            ...result,
            provider: provider.name,
            loadBalancer: {
              strategy,
              providerAttempt,
              totalProviders: attemptedProviders.size,
              currentLoads: Object.fromEntries(this.currentLoads),
            },
          };
        } else {
          console.warn(`⚠️ ${provider.name} failed:`, result.message);
          this.incrementFailure(provider.name);
          lastError = result;
        }
      } catch (error) {
        console.error(`❌ ${provider.name} error:`, error.message);
        this.incrementFailure(provider.name);
        lastError = {
          success: false,
          message: error.message,
          provider: provider.name,
        };
      } finally {
        // Always decrement load
        this.decrementLoad(provider.name);
      }
    }

    // All providers failed
    console.error("❌ All AI providers failed!");
    return {
      success: false,
      message: "All AI providers failed",
      error: lastError,
      loadBalancer: {
        strategy,
        attemptedProviders: Array.from(attemptedProviders),
        totalAttempts: maxProviderRetries,
        currentLoads: Object.fromEntries(this.currentLoads),
        failureCounts: Object.fromEntries(this.failureCount),
      },
    };
  }

  /**
   * Generate JSON content using load balanced AI providers
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Generation options
   * @returns {Object} Response with parsed JSON content
   */
  async generateJsonContent(prompt, options = {}) {
    const strategy = options.strategy || "weighted";
    const maxProviderRetries = options.maxProviderRetries || 3; // Increased default
    const baseDelay = options.baseDelay || 0; // EXTREME FAST: Không delay để đạt 10-15s

    let lastError = null;
    let attemptedProviders = new Set();

    // Enhanced retry logic với tăng số lần thử cho từng provider
    for (
      let providerAttempt = 1;
      providerAttempt <= maxProviderRetries;
      providerAttempt++
    ) {
      // Reset attempted providers sau 2 lần thử để có thể thử lại providers tốt
      if (
        providerAttempt > 2 &&
        attemptedProviders.size >= AI_PROVIDERS.length
      ) {
        console.log(
          `🔄 Resetting attempted providers for retry ${providerAttempt}`
        );
        attemptedProviders.clear();
      }

      const provider = this.selectProvider(strategy);

      // Skip nếu đã thử provider này gần đây (trừ khi đã reset)
      if (
        attemptedProviders.has(provider.name) &&
        attemptedProviders.size < AI_PROVIDERS.length
      ) {
        console.log(
          `⏭️ Skipping recently attempted provider: ${provider.name}`
        );
        continue;
      }

      attemptedProviders.add(provider.name);
      this.incrementLoad(provider.name);
      this.lastUsed.set(provider.name, Date.now());

      try {
        console.log(
          `🚀 JSON generation attempt ${providerAttempt}/${maxProviderRetries} with ${provider.name}`
        );

        const result = await provider.service.generateJsonContent(prompt);

        // Enhanced result validation
        const isWrapped =
          result &&
          typeof result === "object" &&
          ("success" in result || "data" in result);
        const data = isWrapped
          ? result.data ?? result.content ?? result.result
          : result;

        if (!data) {
          const message =
            isWrapped && result && result.message
              ? result.message
              : "Empty data returned";
          console.warn(`⚠️ ${provider.name} JSON failed:`, message);
          this.incrementFailure(provider.name);
          lastError = { success: false, message, provider: provider.name };
        } else {
          // Success - reset failure count for this provider
          console.log(`✅ Successfully generated JSON with ${provider.name}`);
          this.failureCount.set(provider.name, 0);

          return {
            success: true,
            data,
            provider: provider.name,
            loadBalancer: {
              strategy,
              providerAttempt,
              totalProviders: attemptedProviders.size,
              failures: this.failureCount.get(provider.name),
            },
          };
        }
      } catch (error) {
        console.error(
          `❌ ${provider.name} JSON error (attempt ${providerAttempt}):`,
          error.message
        );
        this.incrementFailure(provider.name);
        lastError = {
          success: false,
          message: error.message,
          provider: provider.name,
        };

        // Enhanced rate limiting handling
        if (
          error.message.includes("429") ||
          error.message.includes("rate limit") ||
          error.message.includes("quota")
        ) {
          const backoffDelay = Math.min(
            2000, // ULTRA FAST: Giảm từ 10000ms xuống 2000ms
            baseDelay * Math.pow(1.5, providerAttempt - 1) // Giảm multiplier từ 2 xuống 1.5
          );
          console.log(
            `⏳ Rate limited by ${provider.name}, waiting ${backoffDelay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      } finally {
        this.decrementLoad(provider.name);
      }

      // ULTRA FAST delay between provider attempts
      if (providerAttempt < maxProviderRetries) {
        const delay = Math.min(1000, 200 * providerAttempt); // Giảm từ 3000/500 xuống 1000/200
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      message:
        "All AI providers failed for JSON generation after enhanced retries",
      error: lastError,
      loadBalancer: {
        strategy,
        attemptedProviders: Array.from(attemptedProviders),
        totalAttempts: maxProviderRetries,
        finalFailureCounts: Object.fromEntries(this.failureCount),
      },
    };
  }

  /**
   * Test connections to all AI providers
   * @returns {Object} Connection test results
   */
  async testAllConnections() {
    console.log("🔍 Testing all AI provider connections...");

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
          error: error.message,
        };
      }
    }

    const connectedCount = Object.values(results).filter(
      (r) => r.success
    ).length;

    return {
      success: connectedCount > 0,
      message: `${connectedCount}/${AI_PROVIDERS.length} AI providers connected`,
      results,
      summary: {
        total: AI_PROVIDERS.length,
        connected: connectedCount,
        failed: AI_PROVIDERS.length - connectedCount,
      },
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
    console.log("🔄 Resetting AI provider failure counts");
    AI_PROVIDERS.forEach((provider) => {
      this.failureCount.set(provider.name, 0);
    });
  }

  getStats() {
    return {
      providers: AI_PROVIDERS.map((p) => ({
        name: p.name,
        priority: p.priority,
        weight: p.weight,
        maxConcurrent: p.maxConcurrent,
        currentLoad: this.currentLoads.get(p.name),
        failures: this.failureCount.get(p.name),
        lastUsed: this.lastUsed.get(p.name),
      })),
      timestamp: Date.now(),
    };
  }
}

// Singleton instance
const multiAiLoadBalancer = new MultiAiLoadBalancer();

export default multiAiLoadBalancer;
