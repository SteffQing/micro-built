import { api, uploads } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const base = "/user/";

export const updateImage = mutationOptions({
	mutationKey: [base, "avatar"],
	mutationFn: async (data: File) => {
		const formData = new FormData();
		formData.append("file", data);
		const res = await uploads.post<ApiRes<AvatarDto>>(base + "avatar", formData);
		return res.data;
	},
	onSuccess: (data) =>
		queryClient
			.invalidateQueries({ queryKey: [base] })
			.then(() => toast.success(data.message)),
});

export const updateIdentity = mutationOptions({
	mutationKey: [base, "identity"],
	mutationFn: async (data: Partial<UserIdentityDto>) => {
		const res = await api.patch<ApiRes<null>>(base + "identity", data);
		return res.data;
	},
	onSuccess: (data) => {
		queryClient.invalidateQueries({ queryKey: [base, "identity"] });
		toast.success(data.message);
	},
});

export const createPayroll = mutationOptions({
	mutationKey: [base, "payroll", "create"],
	mutationFn: async (data: CreatePayrollDto) => {
		const res = await api.post<ApiRes<null>>(base + "payroll", data);
		return res.data;
	},
	onSuccess: (data) => {
		queryClient.invalidateQueries({ queryKey: [base, "payroll"] });
		toast.success(data.message);
	},
});

export const updatePayroll = mutationOptions({
	mutationKey: [base, "payroll", "update"],
	mutationFn: async (data: Partial<CreatePayrollDto>) => {
		const res = await api.patch<ApiRes<null>>(base + "payroll", data);
		return res.data;
	},
	onSuccess: (data) => {
		queryClient.invalidateQueries({ queryKey: [base, "payroll"] });
		toast.success(data.message);
	},
});

export const createPaymentMethod = mutationOptions({
	mutationKey: [base, "payment-method", "create"],
	mutationFn: async (data: CreatePaymentMethodDto) => {
		const res = await api.post<ApiRes<null>>(base + "payment-method", data);
		return res.data;
	},
	onSuccess: (data) => {
		queryClient.invalidateQueries({ queryKey: [base, "payment-method"] });
		toast.success(data.message);
	},
});

export const updatePaymentMethod = mutationOptions({
	mutationKey: [base, "payment-method", "update"],
	mutationFn: async (data: Partial<CreatePaymentMethodDto>) => {
		const res = await api.patch<ApiRes<null>>(base + "payment-method", data);
		return res.data;
	},
	onSuccess: (data) => {
		queryClient.invalidateQueries({ queryKey: [base, "payment-method"] });
		toast.success(data.message);
	},
});
