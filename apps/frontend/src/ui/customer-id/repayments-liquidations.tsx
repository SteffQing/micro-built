"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppliedTab } from "@/ui/repayments/admin-repayments-view/applied-table";
import { DeductionsTab } from "@/ui/repayments/admin-repayments-view/deductions-table";
import InflowsTable from "@/ui/repayments/admin-repayments-view/table";

/**
 * The customer's money trail in one card, mirroring the Repayments page: what each month expected (deductions),
 * what came in from payroll or a liquidation (inflows, with their source and review actions), and how it was
 * applied to loans (repayments).
 */
export default function RepaymentsAndLiquidations({ customerId }: { customerId: string }) {
  return (
    <Card className="gap-0 overflow-hidden bg-background p-0">
      <div className="px-4 py-4 sm:px-5">
        <h2 className="font-semibold text-foreground">Repayments &amp; Liquidations</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Monthly deductions, money received from payroll and liquidations, and how it was applied to loans.
        </p>
      </div>
      <Separator className="bg-border" />
      <Tabs defaultValue="repayments" className="gap-0">
        <div className="overflow-x-auto px-4 pt-3 sm:px-5">
          <TabsList className="w-full min-w-max justify-start bg-muted sm:w-fit">
            <TabsTrigger value="repayments">Repayments</TabsTrigger>
            <TabsTrigger value="deductions">Deductions</TabsTrigger>
            <TabsTrigger value="inflows">Inflows</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="repayments">
          <AppliedTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="deductions">
          <DeductionsTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="inflows">
          <InflowsTable customerId={customerId} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
