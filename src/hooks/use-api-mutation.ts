import {
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query";
import { AxiosError } from "axios";
import { apiClient } from "@/lib/apiClient";

type HttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";

interface MutationHookOptions<TData, TVariables> {
  endpoint: string | ((variables: TVariables) => string);
  method?: HttpMethod;
  isMultiPart?: boolean;
  toBody?: (variables: TVariables) => unknown;
  invalidateKeys?: string[]; // 🔥 cache invalidation
  mutationOptions?: UseMutationOptions<TData, AxiosError, TVariables>;
}

export function useApiMutation<TData = unknown, TVariables = unknown>({
  endpoint,
  method = "POST",
  isMultiPart = false,
  toBody,
  invalidateKeys = [],
  mutationOptions,
}: MutationHookOptions<TData, TVariables>): UseMutationResult<
  TData,
  AxiosError,
  TVariables
> {
  const queryClient = useQueryClient();

  return useMutation<TData, AxiosError, TVariables>({
    mutationFn: async (variables) => {
      const url =
        typeof endpoint === "function" ? endpoint(variables) : endpoint;

      const response = await apiClient.request<TData>({
        url,
        method,
        data: toBody ? toBody(variables) : variables,
        headers: {
          "Content-Type": isMultiPart
            ? "multipart/form-data"
            : "application/json",
        },
      });

      return response.data;
    },

    onSuccess: (data, variables, context) => {
      // 🔥 auto invalidate queries
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });

      mutationOptions?.onSuccess?.(data, variables, context, undefined as never);
    },

    ...mutationOptions,
  });
}

