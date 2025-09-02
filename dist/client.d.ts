export interface YouMapClientConfig {
    baseURL: string;
    clientId?: string;
    clientSecret?: string;
}
export declare class YouMapClient {
    private client;
    private config;
    private authTokens?;
    private isAuthenticating;
    constructor(config: YouMapClientConfig);
    private ensureAuthenticated;
    private isTokenExpired;
    private authenticate;
    private refreshAccessToken;
    get(path: string, params?: any): Promise<any>;
    post(path: string, data?: any): Promise<any>;
    put(path: string, data?: any): Promise<any>;
    delete(path: string): Promise<any>;
    patch(path: string, data?: any): Promise<any>;
}
//# sourceMappingURL=client.d.ts.map