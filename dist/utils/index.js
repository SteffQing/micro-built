"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = void 0;
exports.generate6DigitCode = generate6DigitCode;
const generateId = require("./generate-id");
exports.generateId = generateId;
function generate6DigitCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
//# sourceMappingURL=index.js.map