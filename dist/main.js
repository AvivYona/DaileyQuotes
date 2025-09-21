"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const database_config_1 = require("./config/database.config");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    app.use((req, res, next) => {
        const startTime = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms - ${req.ip}`);
        });
        next();
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
    }));
    await app.listen(database_config_1.databaseConfig.port);
    logger.log(`Application is running on: http://localhost:${database_config_1.databaseConfig.port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map