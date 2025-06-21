import { AuthService } from './auth.service';
import { LoginDto, SignupDto, VerifyCodeDto } from './dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    signup(dto: SignupDto): Promise<{
        message: string;
        userId: string;
    }>;
    login(dto: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            name: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    }>;
    verifyCode(dto: VerifyCodeDto): Promise<{
        message: string;
        userId: string;
    }>;
}
