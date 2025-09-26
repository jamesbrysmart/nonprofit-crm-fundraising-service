import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface RequestContextStore {
  readonly requestId?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  runWith<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  getStore(): RequestContextStore | undefined {
    return this.storage.getStore();
  }

  getRequestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }
}
