declare global {
  namespace NodeJS {
    interface ProcessEnv {
      YOUMAP_API_URL?: string;
      YOUMAP_API_KEY?: string;
      BFL_API_KEY?: string;
      SERP_API_KEY?: string;
      UNSPLASH_ACCESS_KEY?: string;
      NODE_ENV?: "development" | "production" | "test";
    }
  }
}

export {};
