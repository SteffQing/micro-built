import {
  Gender,
  LoanCategory,
  MaritalStatus,
  Relationship,
} from "@/config/enums";
import { z } from "zod";

const phoneNg = z
  .string()
  .regex(
    /^0\d{10}$/,
    "Invalid NG phone number, expected 11 digits starting with 0"
  );

const decimalTwo = z
  .string()
  .regex(/^\d+(\.\d{2})$/, "Expected decimal string with 2 fractional digits");

const nonEmptyString = z
  .string({ required_error: "Please provide a value to this input" })
  .min(1);

const CreateIdentitySchema = z.object({
  dateOfBirth: z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "Invalid ISO date string",
  }),
  documents: z.array(nonEmptyString).min(1),
  residencyAddress: nonEmptyString,
  stateResidency: nonEmptyString,
  landmarkOrBusStop: nonEmptyString,
  nextOfKinName: nonEmptyString,
  nextOfKinContact: phoneNg,
  nextOfKinAddress: nonEmptyString,
  nextOfKinRelationship: z.nativeEnum(Relationship),
  gender: z.nativeEnum(Gender),
  maritalStatus: z.nativeEnum(MaritalStatus),
});

const CreatePaymentMethodSchema = z.object({
  bankName: nonEmptyString,
  accountNumber: z
    .string()
    .regex(/^\d{10}$/, "Account number must be 10 digits"),
  accountName: nonEmptyString,
});

const CreatePayrollSchema = z.object({
  externalId: nonEmptyString,
  employeeGross: decimalTwo,
  netPay: decimalTwo,
  grade: nonEmptyString,
  step: z.coerce.number().int().min(1, "Step must be at least 1"),
  command: nonEmptyString,
});

const CustomerUserSchema = z
  .object({
    email: z
      .union([
        z.string().email("Invalid email address"),
        z.literal(""), // explicitly allow empty
      ])
      .optional(),
    contact: z.union([phoneNg, z.literal("")]).optional(),
    name: nonEmptyString,
  })
  .refine((data) => !!data.email?.trim() || !!data.contact?.trim(), {
    message: "Either email or phone number is required",
    path: ["email"],
  });

const CustomerCashLoanSchema = z.object({
  amount: z.coerce.number().positive(),
  tenure: z.coerce.number().int().min(1),
});

const CustomerCommodityLoanSchema = z.object({
  assetName: nonEmptyString,
  publicDetails: nonEmptyString,
  privateDetails: nonEmptyString,
  amount: z.coerce.number(),
  tenure: z.coerce.number().int().min(1),
  managementFeeRate: z.coerce.number().int().min(1).max(100),
});

const CustomerLoanSchema = z.object({
  category: z.nativeEnum(LoanCategory),
  cashLoan: CustomerCashLoanSchema.optional(),
  commodityLoan: CustomerCommodityLoanSchema.optional(),
});

export const OnboardCustomerSchema = z.object({
  payroll: CreatePayrollSchema,
  identity: CreateIdentitySchema,
  paymentMethod: CreatePaymentMethodSchema,
  user: CustomerUserSchema,
  loan: CustomerLoanSchema.optional(),
});

export type OnboardCustomerType = z.infer<typeof OnboardCustomerSchema>;
