import { toast } from 'vue-sonner';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export function useToast() {
    const createToast = (message: string, type: ToastType = 'info', duration: number = 2500) => {
        const show =
            type === 'success'
                ? toast.success
                : type === 'error'
                  ? toast.error
                  : type === 'warning'
                    ? toast.warning
                    : toast.info;

        return show(message, { duration: duration > 0 ? duration : Infinity });
    };

    const destroyToast = (id?: string | number) => {
        toast.dismiss(id);
    };

    return { createToast, destroyToast };
}
