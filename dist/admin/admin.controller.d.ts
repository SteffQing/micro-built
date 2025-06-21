import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    upgradeUser(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        contact: string;
        password: string;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        role: import(".prisma/client").$Enums.UserRole;
    }>;
    makeVendor(userId: string): Promise<{
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
