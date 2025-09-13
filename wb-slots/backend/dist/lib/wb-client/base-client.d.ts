import { AxiosInstance } from 'axios';
export declare abstract class BaseWBClient {
    protected client: AxiosInstance;
    protected token: string;
    constructor(token: string, baseURL: string);
    protected get<T>(url: string, params?: Record<string, any>): Promise<T>;
    protected post<T>(url: string, data?: any, params?: Record<string, any>): Promise<T>;
    protected put<T>(url: string, data?: any, params?: Record<string, any>): Promise<T>;
    protected delete<T>(url: string, params?: Record<string, any>): Promise<T>;
    private handleError;
}
