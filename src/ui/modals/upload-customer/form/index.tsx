import type { Dispatch, SetStateAction } from "react";
import { CustomerDetail, UserIdentity } from "./ui";

interface Props {
  step: number;
  setSelectedFile: Dispatch<SetStateAction<File | null>>;
  selectedFile: File | null;
}

export default function UploadCustomerForm({
  step,
  setSelectedFile,
  selectedFile,
}: Props) {
  console.log("Current step:", step);

  const renderForm = () => {
    switch (step) {
      case 1:
        return (
          <CustomerDetail
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
          />
        );
      case 2:
        return <UserIdentity />;
      default:
        return <></>;
    }
  };

  return <section className="flex flex-col gap-4">{renderForm()}</section>;
}
