import { useToast } from '@/composables/useToast';
import type { Errors, FormDataType, HttpRequestHeaders } from '@inertiajs/core';
import { useHttp } from '@inertiajs/vue3';
import { useSocketId } from '@laravel/echo-vue';

const GENERIC_MESSAGE = 'Something went wrong';

const STATUS_MESSAGES: Record<number, string> = {
    401: 'Your session has expired. Sign in again to continue.',
    403: 'You do not have permission to make this change.',
    404: 'This item is no longer available. Refresh the page.',
    413: 'This file is too large. Choose a smaller file.',
    419: 'Your session has expired. Refresh the page and try again.',
    429: 'Too many requests. Wait a moment and try again.',
    500: 'The change could not be saved. Please try again.',
    503: 'The service is temporarily unavailable. Try again shortly.',
};

type RequestMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RequestOptions<TResponse> {
    headers?: HttpRequestHeaders;
    onSuccess?: (response: TResponse) => void;
    onInvalid?: (errors: Errors) => void;
    onFailure?: (message: string) => void;
    onFinish?: () => void;
}

type RequestSender = <TResponse = unknown>(
    url: string,
    options?: RequestOptions<TResponse>
) => void;

type Request<TForm extends FormDataType<TForm>> = Omit<
    ReturnType<typeof useHttp<TForm>>,
    RequestMethod
> &
    Record<RequestMethod, RequestSender>;

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export function useRequest<TForm extends FormDataType<TForm>>(initialData: TForm): Request<TForm> {
    const { createToast } = useToast();
    const socketId = useSocketId();
    const http = useHttp<TForm>(initialData);

    const submit = {
        get: http.get,
        post: http.post,
        put: http.put,
        patch: http.patch,
        delete: http.delete,
    };

    function send<TResponse>(
        method: RequestMethod,
        url: string,
        options: RequestOptions<TResponse> = {}
    ): void {
        const fail = (message: string): false => {
            createToast(message, 'error');
            options.onFailure?.(message);

            return false;
        };

        submit[method](url, {
            headers: {
                ...(socketId.value ? { 'X-Socket-Id': socketId.value } : {}),
                ...options.headers,
            },
            onSuccess: response => options.onSuccess?.(response as TResponse),
            onError: errors => options.onInvalid?.(errors),
            onHttpException: response => fail(STATUS_MESSAGES[response.status] ?? GENERIC_MESSAGE),
            onNetworkError: () => fail(GENERIC_MESSAGE),
            onFinish: () => options.onFinish?.(),
        }).catch(() => {});
    }

    const senders = Object.fromEntries(
        METHODS.map(method => [
            method,
            (url: string, options?: RequestOptions<unknown>) => send(method, url, options),
        ])
    ) as Record<RequestMethod, RequestSender>;

    return Object.assign(http, senders) as Request<TForm>;
}
