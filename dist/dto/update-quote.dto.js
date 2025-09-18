"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateQuoteDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_quote_dto_1 = require("./create-quote.dto");
class UpdateQuoteDto extends (0, mapped_types_1.PartialType)(create_quote_dto_1.CreateQuoteDto) {
}
exports.UpdateQuoteDto = UpdateQuoteDto;
//# sourceMappingURL=update-quote.dto.js.map