"use client";

import { PaymentMethodEmpty, PaymentMethodLoading } from "./components";
import PaymentMethodDisplay from "./display";
import { useQuery } from "@tanstack/react-query";
import { userPaymentMethod } from "@/lib/queries/user";

export function PaymentMethod() {
  const { data, isLoading } = useQuery(userPaymentMethod);
  const paymentMethod = data?.data;

  if (isLoading) {
    return <PaymentMethodLoading />;
  }

  return !paymentMethod ? <PaymentMethodEmpty /> : <PaymentMethodDisplay {...paymentMethod} />;
}
