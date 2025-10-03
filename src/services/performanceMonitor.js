// Performance Monitor for improved response time
class PerformanceMonitor {
    constructor() {
        this.responseTimes = [];
        this.successCount = 0;
        this.timeoutCount = 0;
        this.target = { min: 30000, max: 60000 }; // 30-60s more realistic target
    }

    startTimer() {
        return Date.now();
    }

    endTimer(startTime, success = true) {
        const responseTime = Date.now() - startTime;
        this.responseTimes.push(responseTime);

        if (success) {
            this.successCount++;

            // Check if within target range
            if (responseTime <= this.target.max) {
                console.log(`🚀 SUCCESS: ${responseTime}ms (Target: ${this.target.min}-${this.target.max}ms)`);
                return true;
            } else {
                console.log(`⚠️ SLOW: ${responseTime}ms (Target: ${this.target.min}-${this.target.max}ms)`);
                return false;
            }
        } else {
            this.timeoutCount++;
            console.log(`❌ TIMEOUT: ${responseTime}ms`);
            return false;
        }
    }

    getStats() {
        const total = this.responseTimes.length;
        if (total === 0) return { message: "No data yet" };

        const average = this.responseTimes.reduce((a, b) => a + b, 0) / total;
        const withinTarget = this.responseTimes.filter(t => t <= this.target.max).length;
        const successRate = (this.successCount / total) * 100;
        const targetRate = (withinTarget / total) * 100;

        return {
            total,
            average: Math.round(average),
            successRate: Math.round(successRate),
            targetRate: Math.round(targetRate),
            target: `${this.target.min / 1000}-${this.target.max / 1000}s`,
            fastest: Math.min(...this.responseTimes),
            slowest: Math.max(...this.responseTimes),
            timeouts: this.timeoutCount
        };
    }

    resetStats() {
        this.responseTimes = [];
        this.successCount = 0;
        this.timeoutCount = 0;
    }
}

module.exports = new PerformanceMonitor();