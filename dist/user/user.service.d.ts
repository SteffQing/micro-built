import { PrismaService } from '../prisma/prisma.service';
export declare class UserService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getProfileById(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        contact: string;
        status: import(".prisma/client").$Enums.UserStatus;
        role: import(".prisma/client").$Enums.UserRole;
    }>;
}
