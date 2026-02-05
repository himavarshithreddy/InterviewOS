import React from 'react';
import { Toast as ToastType } from '../hooks/useToast';

interface ToastProps {
    toast: ToastType;
    onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
    const { id, message, type } = toast;

    const getTypeStyles = () => {
        switch (type) {
            case 'success':
                return 'bg-green-600 border-green-500';
            case 'error':
                return 'bg-red-600 border-red-500';
            case 'warning':
                return 'bg-orange-600 border-orange-500';
            case 'info':
            default:
                return 'bg-blue-600 border-blue-500';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '⚠';
            case 'info':
            default:
                return 'ℹ';
        }
    };

    return (
        <div
            className={`${getTypeStyles()} border-l-4 rounded-lg shadow-lg p-4 mb-3 flex items-start gap-3 animate-slide-in max-w-md`}
            role="alert"
        >
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white bg-opacity-20 rounded-full font-bold">
                {getIcon()}
            </div>
            <div className="flex-1 text-white text-sm">{message}</div>
            <button
                onClick={() => onClose(id)}
                className="flex-shrink-0 text-white hover:text-slate-200 transition-colors"
                aria-label="Close"
            >
                ✕
            </button>
        </div>
    );
};

interface ToastContainerProps {
    toasts: ToastType[];
    onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col items-end">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onClose={onClose} />
            ))}
        </div>
    );
};

// Add animation to index.css
export const toastStyles = `
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
`;
