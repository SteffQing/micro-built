export declare class RedisService {
    private client;
    constructor();
    setEx(key: string, value: string, ttlSeconds?: number): Promise<void>;
    set(key: string, value: string): Promise<void>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<void>;
}
