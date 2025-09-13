"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WBClientError = exports.TOKEN_CATEGORY_TO_BASE_URL = exports.WB_API_BASE_URLS = void 0;
exports.WB_API_BASE_URLS = {
    SUPPLIES: 'https://supplies-api.wildberries.ru',
    MARKETPLACE: 'https://marketplace-api.wildberries.ru',
    STATISTICS: 'https://statistics-api.wildberries.ru',
    CONTENT: 'https://content-api.wildberries.ru',
    PROMOTION: 'https://promotion-api.wildberries.ru',
    ANALYTICS: 'https://analytics-api.wildberries.ru',
    FINANCE: 'https://finance-api.wildberries.ru',
};
exports.TOKEN_CATEGORY_TO_BASE_URL = {
    STATISTICS: exports.WB_API_BASE_URLS.STATISTICS,
    SUPPLIES: exports.WB_API_BASE_URLS.SUPPLIES,
    MARKETPLACE: exports.WB_API_BASE_URLS.MARKETPLACE,
    CONTENT: exports.WB_API_BASE_URLS.CONTENT,
    PROMOTION: exports.WB_API_BASE_URLS.PROMOTION,
    ANALYTICS: exports.WB_API_BASE_URLS.ANALYTICS,
    FINANCE: exports.WB_API_BASE_URLS.FINANCE,
};
class WBClientError extends Error {
    constructor(message, statusCode, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'WBClientError';
    }
}
exports.WBClientError = WBClientError;
//# sourceMappingURL=types.js.map