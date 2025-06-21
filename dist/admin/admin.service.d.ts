import { PrismaService } from '../prisma/prisma.service';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    upgradeUserToAdmin(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        contact: string;
        password: string;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        role: import(".prisma/client").$Enums.UserRole;
    }>;
    upgradeUserToVendor(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        contact: string;
        password: string;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        role: import(".prisma/client").$Enums.UserRole;
    }>;
}
