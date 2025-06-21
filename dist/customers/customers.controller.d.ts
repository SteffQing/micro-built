import { CustomersService } from './customers.service';
export declare class CustomersController {
    private readonly customersService;
    constructor(customersService: CustomersService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        loans: {
            id: string;
            status: import(".prisma/client").$Enums.LoanStatus;
            createdAt: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
            interestRate: import("@prisma/client/runtime/library").Decimal;
            lateFeeRate: import("@prisma/client/runtime/library").Decimal;
            revenue: import("@prisma/client/runtime/library").Decimal;
            loanType: import(".prisma/client").$Enums.LoanType;
            category: import(".prisma/client").$Enums.LoanCategory;
            disbursementDate: Date | null;
            dueDate: Date;
            borrowerId: string;
            updatedAt: Date;
            assetId: string | null;
        }[];
    } & {
        id: string;
        name: string;
        email: string;
        contact: string;
        password: string;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        role: import(".prisma/client").$Enums.UserRole;
    })[]>;
}
