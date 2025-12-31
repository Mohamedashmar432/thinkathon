"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiKey = generateApiKey;
const crypto_1 = __importDefault(require("crypto"));
function generateApiKey(email) {
    const secret = process.env.SECRET_SALT || 'default-secret';
    const timestamp = Date.now().toString();
    const data = `${email}-${secret}-${timestamp}`;
    return crypto_1.default
        .createHash('sha256')
        .update(data)
        .digest('hex');
}
