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

const nonEmptyString = z.string().min(1);

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
  step: z.number().int(),
  command: nonEmptyString,
});

const CustomerUserSchema = z.object({
  email: z.string().email().optional(),
  contact: phoneNg.optional(),
  name: nonEmptyString,
});

const CustomerCashLoanSchema = z.object({
  amount: z.number().positive(),
  tenure: z.number().int().min(1),
});

const CustomerCommodityLoanSchema = z.object({
  assetName: nonEmptyString,
  publicDetails: nonEmptyString,
  privateDetails: nonEmptyString,
  amount: z.number(),
  tenure: z.number().int().min(1),
  managementFeeRate: z.number().int().min(1).max(100),
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
