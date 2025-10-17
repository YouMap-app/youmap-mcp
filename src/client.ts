import axios, { AxiosInstance } from "axios";

export interface YouMapClientConfig {
  baseURL: string;
  clientId?: string;
  clientSecret?: string;
  serpApiKey?: string;
  unsplashAccessKey?: string;
  bflApiKey?: string;
}

interface AuthTokens {
  token: string;
  refreshToken: string;
  expiresIn: number;
  obtainedAt: number;
}

export class YouMapClient {
  private client: AxiosInstance;
  private config: YouMapClientConfig;
  private authTokens?: AuthTokens;
  private isAuthenticating = false;

  constructor(config: YouMapClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.client.interceptors.request.use(async (config) => {
      await this.ensureAuthenticated();

      if (this.authTokens) {
        config.headers.Authorization = `Bearer ${this.authTokens.token}`;
      }

      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.authTokens) {
          try {
            await this.refreshAccessToken();
            const originalRequest = error.config;
            if (this.authTokens) {
              originalRequest.headers.Authorization = `Bearer ${this.authTokens.token}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            this.authTokens = undefined;
            await this.ensureAuthenticated();
            const originalRequest = error.config;
            const tokens = this.authTokens as AuthTokens | undefined;
            if (tokens) {
              originalRequest.headers.Authorization = `Bearer ${tokens.token}`;
              return this.client(originalRequest);
            } else {
              throw new Error(
                "Failed to authenticate after token refresh failure"
              );
            }
          }
        }
        throw error;
      }
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.isAuthenticating) {
      while (this.isAuthenticating) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    if (this.authTokens && !this.isTokenExpired()) {
      return;
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error(
        "YOUMAP_CLIENT_ID and YOUMAP_CLIENT_SECRET environment variables are required for authentication"
      );
    }

    await this.authenticate();
  }

  private isTokenExpired(): boolean {
    if (!this.authTokens) return true;

    const now = Date.now();
    const expirationTime =
      this.authTokens.obtainedAt + this.authTokens.expiresIn * 1000;
    return now >= expirationTime - 5 * 60 * 1000;
  }

  private async authenticate(): Promise<void> {
    this.isAuthenticating = true;

    try {
      const response = await axios.post(`${this.config.baseURL}/api/v1/auth`, {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      });

      this.authTokens = {
        token: response.data.token,
        refreshToken: response.data.refreshToken,
        expiresIn: parseInt(response.data.expiresIn),
        obtainedAt: Date.now(),
      };
    } finally {
      this.isAuthenticating = false;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.authTokens) {
      throw new Error("No refresh token available");
    }

    const response = await axios.post(
      `${this.config.baseURL}/api/v1/auth/refreshAccessToken`,
      {
        refreshToken: this.authTokens.refreshToken,
      }
    );

    this.authTokens = {
      token: response.data.token,
      refreshToken: response.data.refreshToken,
      expiresIn: parseInt(response.data.expiresIn),
      obtainedAt: Date.now(),
    };
  }

  async get(path: string, params?: any) {
    const response = await this.client.get(path, { params });
    return response.data;
  }

  async post(path: string, data?: any) {
    const response = await this.client.post(path, data);
    return response.data;
  }

  async put(path: string, data?: any) {
    const response = await this.client.put(path, data);
    return response.data;
  }

  async delete(path: string) {
    const response = await this.client.delete(path);
    return response.data;
  }

  async patch(path: string, data?: any) {
    const response = await this.client.patch(path, data);
    return response.data;
  }

  // Getter methods for API keys
  get serpApiKey(): string | undefined {
    return this.config.serpApiKey;
  }

  get unsplashAccessKey(): string | undefined {
    return this.config.unsplashAccessKey;
  }

  get bflApiKey(): string | undefined {
    return this.config.bflApiKey;
  }
}
