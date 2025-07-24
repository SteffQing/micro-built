import { JSX } from "react";

interface Props {
  title: string;
  icon: JSX.Element;
  value: string;
}

export default function ReportCard({ title, icon, value }: Props) {
  return (
    <div className="bg-white border border-[#F0F0F0] rounded-[12px] p-4 lg:p-5 flex flex-col gap-2 w-full">
      <span className="mb-4 lg:mb-5">{icon}</span>
      <h3 className="text-black text-2xl font-semibold">{value}</h3>
      <p className="text-[#999999] text-sm font-normal">{title}</p>
    </div>
  );
}
