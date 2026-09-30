import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { setParams } from "@/lib/utils";

type ExportParams = Record<
  string,
  string | number | boolean | Date | undefined | null
>;

/**
 * Generic list-export trigger shared by every table (admin + user). `path` is
 * the export endpoint (e.g. "/admin/exports/customers"); the same filter object
 * the table sends to its list query is forwarded so the export matches the view.
 */
export const exportList = (path: string) =>
  mutationOptions({
    mutationKey: ["export", path],
    mutationFn: async (params: ExportParams = {}) => {
      const res = await api.get<ApiRes<null>>(`${path}${setParams(params)}`);
      return res.data;
    },
    onSuccess: (data) => toast.success(data.message),
  });
