"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseWBClient = void 0;
const axios_1 = require("axios");
const types_1 = require("./types");
class BaseWBClient {
    constructor(token, baseURL) {
        this.token = token;
        this.client = axios_1.default.create({
            baseURL,
            timeout: 30000,
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'User-Agent': 'WB-Slots-Service/1.0',
            },
        });
        this.client.interceptors.request.use((config) => {
            console.log(`🌐 WB API Request: ${config.method?.toUpperCase()} ${config.url}`);
            if (config.params) {
                console.log(`📋 Query params:`, config.params);
            }
            if (config.data) {
                console.log(`📦 Request body:`, config.data);
            }
            return config;
        }, (error) => {
            console.error('❌ Request interceptor error:', error);
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            console.log(`✅ WB API Response: ${response.status} ${response.config.url}`);
            return response;
        }, (error) => {
            console.error(`❌ WB API Error: ${error.response?.status} ${error.config?.url}`, {
                message: error.message,
                data: error.response?.data,
            });
            return Promise.reject(error);
        });
    }
    async get(url, params) {
        try {
            const response = await this.client.get(url, { params });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async post(url, data, params) {
        try {
            const response = await this.client.post(url, data, { params });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async put(url, data, params) {
        try {
            const response = await this.client.put(url, data, { params });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async delete(url, params) {
        try {
            const response = await this.client.delete(url, { params });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    handleError(error) {
        if (error.response) {
            const statusCode = error.response.status;
            const data = error.response.data;
            return new types_1.WBClientError(data?.errorText || data?.message || `HTTP ${statusCode} Error`, statusCode, data?.code, data);
        }
        else if (error.request) {
            return new types_1.WBClientError('No response from WB API', 0, 'NO_RESPONSE', { originalError: error.message });
        }
        else {
            return new types_1.WBClientError(error.message || 'Unknown error occurred', 0, 'UNKNOWN_ERROR', { originalError: error });
        }
    }
}
exports.BaseWBClient = BaseWBClient;
//# sourceMappingURL=base-client.js.map