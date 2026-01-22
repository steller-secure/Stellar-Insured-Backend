import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class WalletThrottlerGuard extends ThrottlerGuard {
    protected getTracker(req: Record<string, any>): Promise<string> {
        // Determine the tracker based on wallet address in body, fallback to IP
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Promise.resolve(req.body?.walletAddress || req.ip);
    }

    // Optional: Custom error message
    protected async throwThrottlingException(context: any, throttlerLimitDetail: any): Promise<void> {
        // You could customize the exception here
        await super.throwThrottlingException(context, throttlerLimitDetail);
    }
}
