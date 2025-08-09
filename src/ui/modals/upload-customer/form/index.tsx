import type { Dispatch, SetStateAction } from "react";
import {
  CustomerDetail,
  UserIdentity,
  UserPayroll,
  UserPaymentMethod,
  LoanRequestForm,
} from "./ui";
import CustomerPreviewDialog from "./preview";
import { FormSubmissionSuccess } from "../content";

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
      case 3:
        return <UserPayroll />;
      case 4:
        return <UserPaymentMethod />;
      case 5:
        return <LoanRequestForm />;
      case 6:
        return <CustomerPreviewDialog />;
      case 7:
        return <FormSubmissionSuccess />;
      default:
        return <FormSubmissionSuccess />;
    }
  };

  return <section className="flex flex-col gap-4">{renderForm()}</section>;
}
