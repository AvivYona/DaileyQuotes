import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor() {
    // Force garbage collection every 5 minutes if available
    if (global.gc) {
      setInterval(
        () => {
          this.logMemoryUsage();
          global.gc();
          this.logger.log('Forced garbage collection completed');
        },
        5 * 60 * 1000,
      ); // 5 minutes
    } else {
      this.logger.warn(
        'Garbage collection not available. Start with --expose-gc flag for better memory management.',
      );
    }
  }

  logMemoryUsage(): void {
    const used = process.memoryUsage();
    this.logger.log(
      `Memory Usage - RSS: ${Math.round(used.rss / 1024 / 1024)}MB, ` +
        `Heap Used: ${Math.round(used.heapUsed / 1024 / 1024)}MB, ` +
        `Heap Total: ${Math.round(used.heapTotal / 1024 / 1024)}MB, ` +
        `External: ${Math.round(used.external / 1024 / 1024)}MB`,
    );
  }

  getMemoryUsage() {
    return process.memoryUsage();
  }

  isMemoryUsageHigh(): boolean {
    const used = process.memoryUsage();
    const heapUsedMB = used.heapUsed / 1024 / 1024;
    const heapTotalMB = used.heapTotal / 1024 / 1024;

    // Consider high if heap usage is over 80% of total heap or over 500MB
    return heapUsedMB > 500 || heapUsedMB / heapTotalMB > 0.8;
  }
}
