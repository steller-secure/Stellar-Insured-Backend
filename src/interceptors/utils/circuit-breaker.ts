export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private isOpen = false;
  private readonly threshold: number;
  private readonly resetTimeout: number;

  constructor(threshold = 5, resetTimeoutMs = 30000) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeoutMs;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      this.checkResetTimeout();
      if (this.isOpen) {
        throw new Error('Circuit breaker is open - service temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.isOpen = true;
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.isOpen = false;
  }

  private checkResetTimeout(): void {
    if (this.isOpen && this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeout) {
      this.reset();
    }
  }
}

// Singleton instance for idempotency interceptor
export const idempotencyCircuitBreaker = new CircuitBreaker();