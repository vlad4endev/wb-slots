"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WBClientFactory = void 0;
const supplies_client_1 = require("./supplies-client");
class WBClientFactory {
    static createClient(category, token) {
        switch (category) {
            case 'SUPPLIES':
                return new supplies_client_1.WBSuppliesClient(token);
            default:
                throw new Error(`Unsupported token category: ${category}`);
        }
    }
    static createSuppliesClient(token) {
        return new supplies_client_1.WBSuppliesClient(token);
    }
}
exports.WBClientFactory = WBClientFactory;
__exportStar(require("./types"), exports);
__exportStar(require("./base-client"), exports);
__exportStar(require("./supplies-client"), exports);
//# sourceMappingURL=index.js.map