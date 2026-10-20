import { useTheme } from '../../context/personal_expense/ThemeContext';
import { AlertCircle } from 'lucide-react';

const ConfirmDialog = ({ isOpen, onConfirm, onCancel, title, message }) => {
    const { theme } = useTheme();

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="pem-card relative w-full max-w-md p-6 overflow-hidden rounded-[24px] border border-white/10 bg-[#0c1427]/95 shadow-raised animate-in zoom-in-95 duration-150"
            >
                {/* Top ambient highlight line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />

                <div className="flex items-center gap-3.5 mb-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/25 shadow-sm">
                        <AlertCircle size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-black tracking-tight text-ink m-0">
                            {title || 'Confirm Action'}
                        </h2>
                    </div>
                </div>

                <p className="text-sm leading-relaxed text-ink-muted mb-6">
                    {message || 'Are you sure you want to proceed?'}
                </p>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-2.5 px-4 rounded-control border border-line bg-raised text-sm font-bold text-ink transition-all hover:bg-raised/80 hover:border-line-strong active:scale-95 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 py-2.5 px-4 rounded-control border border-rose-500/30 bg-gradient-to-r from-rose-600 to-rose-500 text-sm font-black text-white shadow-[0_4px_14px_rgba(244,63,94,0.35)] transition-all hover:brightness-110 active:scale-95 cursor-pointer"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;


