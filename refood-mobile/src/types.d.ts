// Dichiarazione per axios
declare module 'axios' {
  export interface AxiosRequestConfig {
    // Aggiungi qualsiasi configurazione di richiesta personalizzata qui
    timeout?: number;
    headers?: any;
    params?: any;
    baseURL?: string;
    responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';
    data?: any;
  }

  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: AxiosRequestConfig;
    request?: any;
  }

  export interface AxiosError<T = any> extends Error {
    config: AxiosRequestConfig;
    code?: string;
    request?: any;
    response?: AxiosResponse<T>;
    isAxiosError: boolean;
  }

  export interface AxiosInstance {
    (config: AxiosRequestConfig): Promise<AxiosResponse>;
    (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
    defaults: AxiosRequestConfig;
    interceptors: {
      request: {
        use: (onFulfilled?: (value: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>, onRejected?: (error: any) => any) => number;
        eject: (id: number) => void;
      };
      response: {
        use: (onFulfilled?: (value: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>, onRejected?: (error: any) => any) => number;
        eject: (id: number) => void;
      };
    };
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  }

  export interface AxiosStatic extends AxiosInstance {
    create(config?: AxiosRequestConfig): AxiosInstance;
    isAxiosError<T = any>(error: any): error is AxiosError<T>;
    CancelToken: CancelTokenStatic;
    isCancel(value: any): boolean;
  }

  export interface CancelToken {
    promise: Promise<any>;
    reason?: any;
    throwIfRequested(): void;
  }

  export interface CancelTokenStatic {
    new (executor: (cancel: any) => void): CancelToken;
    source(): CancelTokenSource;
  }

  export interface CancelTokenSource {
    token: CancelToken;
    cancel(message?: string): void;
  }

  const axios: AxiosStatic;
  export default axios;
}

// Dichiarazione per expo-router
declare module 'expo-router' {
  export interface RouterProps {
    push: (href: string | Record<string, any>) => void;
    replace: (href: string | Record<string, any>) => void;
    back: () => void;
    canGoBack: () => boolean;
    navigate: (href: string) => void;
  }
  
  export const router: RouterProps;
  
  export interface LinkProps {
    href: string;
    asChild?: boolean;
    [key: string]: any;
  }
  
  export const Link: React.FC<LinkProps>;
  
  export type RelativePathString = string;
  export type ExternalPathString = string;
  export type Href = RelativePathString | ExternalPathString | string | Record<string, any>;
  
  export interface TabsProps {
    screenOptions?: Record<string, any>;
    children: React.ReactNode;
  }
  
  export const Tabs: React.FC<TabsProps> & {
    Screen: React.FC<{
      name: string;
      options?: {
        title?: string;
        tabBarIcon?: (props: { color: string; size: number }) => React.ReactNode;
        [key: string]: any;
      };
      children?: React.ReactNode;
    }>;
  };
} 