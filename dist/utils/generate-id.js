"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userId = userId;
exports.adminId = adminId;
exports.vendorId = vendorId;
exports.loanId = loanId;
const nanoid_1 = require("nanoid");
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = (0, nanoid_1.customAlphabet)(alphabet, 5);
function userId() {
    return `MB${nanoid()}`;
}
function adminId() {
    return `AD${nanoid()}`;
}
function vendorId() {
    return `VN${nanoid()}`;
}
function loanId() {
    return `LN${nanoid(6)}`;
}
//# sourceMappingURL=generate-id.js.map