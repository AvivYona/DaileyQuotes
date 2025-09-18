"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
const dotenv = require("dotenv");
dotenv.config();
exports.databaseConfig = {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/daileyquotes',
    port: process.env.PORT || 3000,
};
//# sourceMappingURL=database.config.js.map