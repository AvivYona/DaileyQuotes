"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
const dotenv = require("dotenv");
dotenv.config();
if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
}
exports.databaseConfig = {
    uri: process.env.MONGODB_URI,
    port: process.env.PORT || 3000,
};
//# sourceMappingURL=database.config.js.map