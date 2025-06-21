"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const resend_1 = require("resend");
const render_1 = require("@react-email/render");
const UserSignupVerificationEmail_1 = require("./templates/UserSignupVerificationEmail");
let MailService = class MailService {
    resend;
    constructor() {
        this.resend = new resend_1.Resend(process.env.RESEND_API_KEY);
    }
    async sendUserSignupVerificationEmail(to, code, userName) {
        const text = await (0, render_1.pretty)(await (0, render_1.render)((0, UserSignupVerificationEmail_1.default)({ code, userName })));
        const { error } = await this.resend.emails.send({
            from: 'MicroBuilt <noreply@microbuilt.app>',
            to,
            subject: 'Verify your MicroBuilt account',
            react: (0, UserSignupVerificationEmail_1.default)({ code, userName }),
            text,
        });
        if (error) {
            console.error('❌ Error sending verification email:', error);
            throw new Error('Failed to send email');
        }
        console.log('✅ Verification email sent to', to);
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MailService);
//# sourceMappingURL=mail.service.js.map