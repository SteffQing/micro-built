import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CustomerDetails() {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <Label>Full Name</Label>
        <Input placeholder="Enter Customer's Name" />
      </div>
      <div className="flex gap-2">
        <div>
          <Label>Email Address</Label>
          <Input placeholder="Enter email address" />
        </div>
        <div>
          <Label>Phone Number</Label>
          <Input placeholder="Enter 11-digit phone number" />
        </div>
      </div>
    </section>
  );
}

// function LoanRequestForm(props: RequestModalContentProps) {
//   function handleCategoryChange(newCategory: LoanCategory) {
//     if (
//       props.category === LoanCategory.ASSET_PURCHASE &&
//       newCategory !== LoanCategory.ASSET_PURCHASE
//     ) {
//       props.setCommodity("");
//     } else if (
//       props.category !== LoanCategory.ASSET_PURCHASE &&
//       newCategory === LoanCategory.ASSET_PURCHASE
//     ) {
//       props.setAmount(0);
//     }

//     props.setCategory(newCategory);
//   }
//   return (
//     <>
//       <Separator className="bg-[#F0F0F0]" />
//       <p className="text-sm text-[#666666] font-normal">
//         Please provide the information below before proceeding
//       </p>
//       <div className="flex flex-col gap-3 w-full">
//         <Label className="text-sm font-medium">Loan Type</Label>
//         <Select
//           onValueChange={(value) => handleCategoryChange(value as LoanCategory)}
//         >
//           <SelectTrigger className="w-full">
//             <SelectValue placeholder="Select Loan Type" />
//           </SelectTrigger>
//           <SelectContent>
//             {Object.values(LoanCategory).map((type) => (
//               <SelectItem value={type} key={type}>
//                 {type
//                   .toLowerCase()
//                   .replace(/_/g, " ")
//                   .replace(/\b\w/g, (char) => char.toUpperCase())}
//               </SelectItem>
//             ))}
//           </SelectContent>
//         </Select>
//       </div>
//       {props.category === LoanCategory.ASSET_PURCHASE ? (
//         <CommodityDropdown
//           commodity={props.commodity}
//           setCommodity={props.setCommodity}
//         />
//       ) : (
//         <CashInput amount={props.amount} setAmount={props.setAmount} />
//       )}
//     </>
//   );
// }
