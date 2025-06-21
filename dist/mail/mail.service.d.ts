export declare class MailService {
    private resend;
    constructor();
    sendUserSignupVerificationEmail(to: string, code: string, userName?: string): Promise<void>;
}
