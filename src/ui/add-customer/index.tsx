import type { Dispatch, SetStateAction } from "react";
import {
	CustomerDetail,
	UserIdentity,
	UserPayroll,
	UserPaymentMethod,
	LoanRequestForm,
} from "./customer-detail";
import CustomerPreviewDialog from "./customer-preview";
import { FormSubmissionSuccess } from "./step-header";

interface Props {
	step: number;
	checked: boolean;
	setChecked: Dispatch<SetStateAction<boolean>>;
	customerId?: string;
}

export default function UploadCustomerForm({
	step,
	checked,
	setChecked,
	customerId,
}: Props) {
	const renderForm = () => {
		switch (step) {
			case 1:
				return <CustomerDetail />;
			case 2:
				return <UserIdentity />;
			case 3:
				return <UserPayroll />;
			case 4:
				return <UserPaymentMethod />;
			case 5:
				return <LoanRequestForm />;
			case 6:
				return (
					<CustomerPreviewDialog checked={checked} setChecked={setChecked} />
				);
			default:
				return <FormSubmissionSuccess customerId={customerId} />;
		}
	};

	return <section className="flex flex-col gap-4">{renderForm()}</section>;
}
