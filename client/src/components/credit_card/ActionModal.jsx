import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/primitives';
import { cx } from '../ui/cx';

const ICONS = {
    confirm: HelpCircle,
    danger: AlertCircle,
    success: CheckCircle2,
    error: AlertCircle,
    info: HelpCircle
};

const TONES = {
    confirm: 'bg-info-soft text-info',
    danger: 'bg-neg-soft text-neg',
    success: 'bg-pos-soft text-pos',
    error: 'bg-neg-soft text-neg',
    info: 'bg-violet-soft text-violet'
};

const ActionModal = ({
    isOpen,
    onClose,
    onCancel,
    onConfirm,
    title,
    message,
    type = 'confirm',
    confirmText = 'Confirm',
    cancelText = 'Cancel'
}) => {
    const handleClose = onClose || onCancel;
    const Icon = ICONS[type] || HelpCircle;

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={title}
            size="sm"
            footer={
                <div className="flex gap-3">
                    {(type === 'confirm' || type === 'danger') && (
                        <Button variant="secondary" onClick={handleClose} className="flex-1">
                            {cancelText}
                        </Button>
                    )}
                    <Button
                        variant={type === 'error' || type === 'danger' ? 'danger' : 'primary'}
                        onClick={onConfirm || handleClose}
                        className="flex-1"
                    >
                        {confirmText}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col items-center gap-4 py-2 text-center">
                <span className={cx('grid h-16 w-16 place-items-center rounded-full', TONES[type] || TONES.info)}>
                    <Icon size={30} aria-hidden="true" />
                </span>
                <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
            </div>
        </Modal>
    );
};

export default ActionModal;
