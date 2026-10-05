import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import {
    Archive,
    ArrowLeft,
    Bell,
    Calendar,
    Check,
    Eraser,
    LayoutGrid,
    Lock,
    Maximize2,
    Minimize2,
    PenTool,
    Pin,
    PinOff,
    Trash2,
    Unlock,
    X,
} from 'lucide-react';
import { Button } from '../ui/primitives';
import { cx } from '../ui/cx';
import { useSmartNotes } from '../../context/personal_expense/SmartNotesContext';
import { useToast } from '../../context/ToastContext';

const VIEWS = {
    list: { label: 'Notes', subtitle: 'Smart Keep', empty: 'Notes you add appear here', icon: LayoutGrid },
    reminders: { label: 'Reminders', subtitle: 'Smart Keep', empty: 'No upcoming reminders', icon: Bell },
    archive: { label: 'Archive', subtitle: 'Smart Keep', empty: 'No archived notes', icon: Archive },
    trash: { label: 'Trash', subtitle: 'Smart Keep', empty: 'Trash is empty', icon: Trash2 },
};

const TABS = ['list', 'reminders', 'archive', 'trash'];
const NOTE_COLORS = ['transparent', '#7f1d1d', '#1e3a8a', '#14532d'];

const noteSurface = (color) => (color === 'transparent' || !color ? 'bg-sunken' : '');
const noteSurfaceStyle = (color) =>
    color && color !== 'transparent' ? { backgroundColor: color } : undefined;

const SmartNotesPanel = () => {
    const {
        isOpen,
        closeNotes,
        isPinned,
        setIsPinned,
        notes,
        addNote,
        updateNote,
        deleteNote,
        archiveNote,
        unarchiveNote,
        trashNote,
        restoreNote,
        lockNote,
    } = useSmartNotes();
    const { showToast } = useToast();

    const [view, setView] = useState('list');
    const [editingNote, setEditingNote] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const dragControls = useDragControls();

    const [editorContent, setEditorContent] = useState('');
    const [editorTitle, setEditorTitle] = useState('');
    const [editorMode, setEditorMode] = useState('text');
    const [editorColor, setEditorColor] = useState('transparent');
    const [reminderDate, setReminderDate] = useState('');

    const [showLockPrompt, setShowLockPrompt] = useState(false);
    const [lockPasswordInput, setLockPasswordInput] = useState('');
    const [lockAction, setLockAction] = useState(null);

    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [strokeColor, setStrokeColor] = useState('#ef4444');

    useEffect(() => {
        if (editingNote) {
            setEditorTitle(editingNote.title || '');
            setEditorContent(editingNote.content || '');
            setEditorMode(editingNote.type || 'text');
            setEditorColor(editingNote.color || 'transparent');
            setReminderDate(editingNote.due || '');
        } else {
            setEditorTitle('');
            setEditorContent('');
            setEditorMode('text');
            setEditorColor('transparent');
            setReminderDate('');
        }
    }, [editingNote, isOpen]);

    const handleSave = () => {
        try {
            if (!editorContent.trim() && !editorTitle.trim() && editorMode === 'text') {
                setView('list');
                setEditingNote(null);
                return;
            }

            const noteData = {
                id: editingNote ? editingNote.id : Date.now(),
                title: editorTitle,
                content: editorContent,
                type: editorMode,
                color: editorColor,
                due: reminderDate,
                updatedAt: new Date().toISOString(),
                isArchived: editingNote ? editingNote.isArchived : false,
                pinned: editingNote ? editingNote.pinned : false,
                isLocked: editingNote ? editingNote.isLocked : false,
                lockPassword: editingNote ? editingNote.lockPassword : null,
                isTrashed: editingNote ? editingNote.isTrashed : false,
            };

            if (editingNote) {
                updateNote(noteData.id, noteData);
            } else {
                addNote({ ...noteData, createdAt: new Date().toISOString() });
            }

            if (reminderDate && (!editingNote || editingNote.due !== reminderDate)) {
                showToast(
                    `Reminder set for ${new Date(reminderDate).toLocaleString()}`,
                    'success'
                );
            }
        } catch (err) {
            console.error(err);
        } finally {
            setView('list');
            setEditingNote(null);
        }
    };

    const handleLockAction = () => {
        if (!lockAction) return;
        if (!lockPasswordInput.trim()) {
            showToast('Please enter a password', 'error');
            return;
        }

        if (lockAction.type === 'lock') {
            lockNote(lockAction.noteId, lockPasswordInput);
            showToast('Note locked', 'success');
        } else {
            const note = notes.find((n) => n.id === lockAction.noteId);
            if (note && note.lockPassword === lockPasswordInput) {
                if (lockAction.type === 'unlock') {
                    lockNote(lockAction.noteId, null);
                    showToast('Note unlocked', 'success');
                } else {
                    setEditingNote(note);
                    setView('edit');
                }
            } else {
                showToast('Incorrect password', 'error');
                return;
            }
        }

        setShowLockPrompt(false);
        setLockPasswordInput('');
        setLockAction(null);
    };

    const handleNoteClick = (note) => {
        if (note.isTrashed) return;
        if (note.isLocked) {
            setLockAction({ type: 'open', noteId: note.id });
            setShowLockPrompt(true);
        } else {
            setEditingNote(note);
            setView('edit');
        }
    };

    const handleTextChange = (e) => {
        const val = e.target.value;
        const lastChar = val.slice(-1);

        const regexCalc = /([0-9.+\-*/()\s]+)=$/;
        const matchCalc = val.match(regexCalc);

        if (matchCalc && lastChar === '=') {
            try {
                const sanitized = matchCalc[1].replace(/[^0-9+\-*/(). ]/g, '');
                const result = new Function('return (' + sanitized + ')')();
                if (result !== undefined && !isNaN(result)) {
                    const newVal = val + ' ' + result;
                    setEditorContent(newVal);
                    setTimeout(() => {
                        const el = document.getElementById('smart-note-editor');
                        if (el) el.selectionStart = el.selectionEnd = newVal.length;
                    }, 0);
                    return;
                }
            } catch {
                /* ignore malformed expressions */
            }
        }

        if (val.toLowerCase().endsWith('/reminder')) {
            setEditorContent(val.slice(0, -9));
            showToast('Opening reminder…', 'info');
            setTimeout(() => {
                const dateInput = document.getElementById('reminder-date-input');
                if (dateInput) dateInput.showPicker();
            }, 100);
            return;
        }

        if (val.toLowerCase().endsWith('/date')) {
            setEditorContent(val.slice(0, -5) + new Date().toLocaleDateString());
            return;
        }

        if (val.toLowerCase().endsWith('/time')) {
            setEditorContent(val.slice(0, -5) + new Date().toLocaleTimeString());
            return;
        }

        setEditorContent(val);
    };

    useEffect(() => {
        if (editorMode === 'draw' && canvasRef.current) {
            const canvas = canvasRef.current;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = canvas.offsetWidth * dpr;
            canvas.height = canvas.offsetHeight * dpr;
            const context = canvas.getContext('2d');
            context.scale(dpr, dpr);
            context.lineCap = 'round';
            context.strokeStyle = strokeColor;
            context.lineWidth = 3;
            contextRef.current = context;
        }
        // Canvas resizes only when the editor context changes; changing stroke color must
        // not reset the canvas (that would wipe the in-progress drawing).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorMode, editingNote, isOpen, isMinimized]);

    useEffect(() => {
        if (contextRef.current) contextRef.current.strokeStyle = strokeColor;
    }, [strokeColor]);

    const startDrawing = ({ nativeEvent }) => {
        if (editorMode !== 'draw') return;
        const { offsetX, offsetY } = nativeEvent;
        contextRef.current.beginPath();
        contextRef.current.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const finishDrawing = () => {
        if (!contextRef.current) return;
        contextRef.current.closePath();
        setIsDrawing(false);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing || editorMode !== 'draw') return;
        const { offsetX, offsetY } = nativeEvent;
        contextRef.current.lineTo(offsetX, offsetY);
        contextRef.current.stroke();
    };

    const filteredNotes = notes.filter((n) => {
        if (n.isTrashed) return view === 'trash';
        if (n.isArchived) return view === 'archive';
        if (view === 'reminders') return n.due;
        return view === 'list' && !n.isTrashed && !n.isArchived;
    });

    const activeView = VIEWS[view] || VIEWS.list;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div
                    drag
                    dragListener={false}
                    dragControls={dragControls}
                    dragMomentum={false}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed right-4 top-20 z-[75] flex w-[450px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] border border-line bg-surface text-ink shadow-raised"
                    style={{
                        height: isMinimized ? 'auto' : 'min(700px, calc(100vh - 6rem))',
                    }}
                >
                    <div
                        onPointerDown={(e) => dragControls.start(e)}
                        className="flex cursor-grab select-none items-center justify-between border-b border-line px-5 py-4 active:cursor-grabbing"
                    >
                        <div className="flex items-center gap-2.5 font-bold">
                            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-warn-soft text-warn">
                                <PenTool size={18} />
                            </span>
                            <span className="text-base">Smart Keep</span>
                        </div>

                        <div
                            className="flex gap-1.5"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={() => setIsMinimized(!isMinimized)}
                                aria-label={isMinimized ? 'Expand notes' : 'Minimize notes'}
                                className="grid h-8 w-8 place-items-center rounded-control text-ink-muted transition hover:bg-raised hover:text-ink"
                            >
                                {isMinimized ? <Maximize2 size={17} /> : <Minimize2 size={17} />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPinned(!isPinned)}
                                aria-label={isPinned ? 'Unpin notes' : 'Pin notes'}
                                className={cx(
                                    'grid h-8 w-8 place-items-center rounded-control transition',
                                    isPinned
                                        ? 'bg-warn-soft text-warn'
                                        : 'text-ink-muted hover:bg-raised hover:text-ink'
                                )}
                            >
                                {isPinned ? <Pin size={17} /> : <PinOff size={17} />}
                            </button>
                            <button
                                type="button"
                                onClick={closeNotes}
                                aria-label="Close notes"
                                className="grid h-8 w-8 place-items-center rounded-control text-ink-muted transition hover:bg-raised hover:text-ink"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {isMinimized ? (
                        <div className="p-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMinimized(false);
                                    setView('edit');
                                    setEditingNote(null);
                                }}
                                className="w-full rounded-control border border-line bg-sunken px-4 py-3 text-left text-sm text-ink-muted transition hover:border-line-strong"
                            >
                                Take a note…
                            </button>
                        </div>
                    ) : (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            {view !== 'edit' ? (
                                <>
                                    <div className="flex gap-1 overflow-x-auto border-b border-line px-4">
                                        {TABS.map((tab) => (
                                            <button
                                                key={tab}
                                                type="button"
                                                onClick={() => setView(tab)}
                                                className={cx(
                                                    'shrink-0 border-b-2 px-3 py-2.5 text-xs font-bold transition',
                                                    view === tab
                                                        ? 'border-warn text-warn'
                                                        : 'border-transparent text-ink-muted hover:text-ink'
                                                )}
                                            >
                                                {VIEWS[tab].label}
                                            </button>
                                        ))}
                                    </div>

                                    {view === 'list' ? (
                                        <div className="p-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setView('edit');
                                                    setEditingNote(null);
                                                }}
                                                className="flex w-full items-center justify-between rounded-control border border-line bg-sunken px-4 py-3 text-left text-sm text-ink-muted transition hover:border-line-strong"
                                            >
                                                <span>Take a note…</span>
                                                <PenTool
                                                    size={18}
                                                    className="text-ink-faint hover:text-ink"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setView('edit');
                                                        setEditingNote(null);
                                                        setEditorMode('draw');
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    ) : null}

                                    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                                        {filteredNotes.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-ink-faint">
                                                <activeView.icon size={38} aria-hidden="true" />
                                                <p className="text-sm font-semibold">
                                                    {activeView.empty}
                                                </p>
                                            </div>
                                        ) : (
                                            <AnimatePresence>
                                                {filteredNotes.map((note) => (
                                                    <motion.div
                                                        key={note.id}
                                                        layout
                                                        initial={{ opacity: 0, y: 16 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.94 }}
                                                        onClick={() => handleNoteClick(note)}
                                                        className={cx(
                                                            'flex flex-col gap-2.5 rounded-card border border-line p-4',
                                                            note.isTrashed
                                                                ? 'cursor-default'
                                                                : 'cursor-pointer',
                                                            noteSurface(note.color)
                                                        )}
                                                        style={noteSurfaceStyle(note.color)}
                                                    >
                                                        {note.title ? (
                                                            <h4 className="text-sm font-bold text-ink">
                                                                {note.title}
                                                            </h4>
                                                        ) : null}

                                                        <div className="min-h-5">
                                                            {note.isLocked ? (
                                                                <div className="flex items-center gap-2 py-2.5 text-ink-muted">
                                                                    <Lock size={15} />
                                                                    <span className="text-xs italic">
                                                                        Passcode protected
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <p className="max-h-[100px] overflow-hidden whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                                                                    {note.content ||
                                                                        (note.type === 'draw'
                                                                            ? '(Drawing content)'
                                                                            : '')}
                                                                </p>
                                                            )}
                                                            {note.due ? (
                                                                <div className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-pill bg-warn-soft px-2.5 py-1 text-[11px] font-semibold text-warn">
                                                                    <Calendar size={12} />
                                                                    {new Date(
                                                                        note.due
                                                                    ).toLocaleDateString()}{' '}
                                                                    {new Date(
                                                                        note.due
                                                                    ).toLocaleTimeString([], {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                    })}
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="flex gap-3 text-xs">
                                                            {!note.isTrashed ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        title="Archive"
                                                                        aria-label="Archive note"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            note.isArchived
                                                                                ? unarchiveNote(note.id)
                                                                                : archiveNote(note.id);
                                                                        }}
                                                                        className="text-ink-faint transition hover:text-ink"
                                                                    >
                                                                        <Archive size={15} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title="Lock"
                                                                        aria-label="Lock note"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setLockAction({
                                                                                type: note.isLocked
                                                                                    ? 'unlock'
                                                                                    : 'lock',
                                                                                noteId: note.id,
                                                                            });
                                                                            setShowLockPrompt(true);
                                                                        }}
                                                                        className="text-ink-faint transition hover:text-ink"
                                                                    >
                                                                        {note.isLocked ? (
                                                                            <Lock size={15} />
                                                                        ) : (
                                                                            <Unlock size={15} />
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title="Delete"
                                                                        aria-label="Move note to trash"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            trashNote(note.id);
                                                                        }}
                                                                        className="text-ink-faint transition hover:text-neg"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            restoreNote(note.id);
                                                                        }}
                                                                        className="font-bold text-pos"
                                                                    >
                                                                        Restore
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            deleteNote(note.id);
                                                                        }}
                                                                        className="font-bold text-neg"
                                                                    >
                                                                        Delete forever
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div
                                    className="flex min-h-0 flex-1 flex-col"
                                    style={noteSurfaceStyle(editorColor)}
                                >
                                    <div className="flex items-center justify-between gap-3 border-b border-line p-4">
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition hover:text-ink"
                                        >
                                            <ArrowLeft size={18} /> Back
                                        </button>

                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <input
                                                    id="reminder-date-input"
                                                    type="datetime-local"
                                                    value={reminderDate}
                                                    onChange={(e) =>
                                                        setReminderDate(e.target.value)
                                                    }
                                                    className="absolute inset-0 z-10 cursor-pointer opacity-0"
                                                    aria-label="Set reminder"
                                                />
                                                {reminderDate ? (
                                                    <div className="flex items-center gap-2 rounded-pill bg-warn-soft px-2.5 py-1.5 text-warn">
                                                        <Bell size={15} />
                                                        <span className="text-xs font-semibold">
                                                            {new Date(
                                                                reminderDate
                                                            ).toLocaleDateString()}
                                                        </span>
                                                        <Check
                                                            size={14}
                                                            className="cursor-pointer text-ink"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleSave();
                                                            }}
                                                        />
                                                        <X
                                                            size={14}
                                                            className="cursor-pointer text-ink"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setReminderDate('');
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <Bell
                                                        size={19}
                                                        className="text-ink-muted"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {NOTE_COLORS.map((color) => (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        aria-label={`Note color ${color}`}
                                                        onClick={() => setEditorColor(color)}
                                                        className={cx(
                                                            'h-[18px] w-[18px] rounded-full border border-line transition',
                                                            editorColor === color &&
                                                                'ring-2 ring-brand'
                                                        )}
                                                        style={
                                                            color === 'transparent'
                                                                ? undefined
                                                                : { backgroundColor: color }
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Title"
                                        value={editorTitle}
                                        onChange={(e) => setEditorTitle(e.target.value)}
                                        className="border-none bg-transparent px-5 pt-4 text-xl font-bold text-ink outline-none"
                                    />

                                    <div className="relative min-h-0 flex-1">
                                        {editorMode === 'text' ? (
                                            <textarea
                                                id="smart-note-editor"
                                                value={editorContent}
                                                onChange={handleTextChange}
                                                placeholder="Type '/reminder' to set an alert, or '2+2=' to calculate…"
                                                className="h-full w-full resize-none border-none bg-transparent px-5 pb-5 text-base leading-relaxed text-ink outline-none"
                                            />
                                        ) : (
                                            <div className="relative h-full w-full">
                                                <div className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-2.5 rounded-pill border border-line bg-surface px-4 py-2 shadow-card">
                                                    {['#ef4444', '#3b82f6', '#10b981'].map((c) => (
                                                        <button
                                                            key={c}
                                                            type="button"
                                                            aria-label={`Pen color ${c}`}
                                                            onClick={() => setStrokeColor(c)}
                                                            className={cx(
                                                                'h-4 w-4 rounded-full',
                                                                strokeColor === c &&
                                                                    'ring-2 ring-ink'
                                                            )}
                                                            style={{ backgroundColor: c }}
                                                        />
                                                    ))}
                                                    <span className="h-4 w-px bg-line" />
                                                    <button
                                                        type="button"
                                                        aria-label="Clear canvas"
                                                        onClick={() => {
                                                            const ctx =
                                                                canvasRef.current.getContext(
                                                                    '2d'
                                                                );
                                                            ctx.clearRect(
                                                                0,
                                                                0,
                                                                canvasRef.current.width,
                                                                canvasRef.current.height
                                                            );
                                                        }}
                                                        className="text-neg"
                                                    >
                                                        <Eraser size={15} />
                                                    </button>
                                                </div>
                                                <canvas
                                                    ref={canvasRef}
                                                    onMouseDown={startDrawing}
                                                    onMouseUp={finishDrawing}
                                                    onMouseMove={draw}
                                                    onMouseLeave={finishDrawing}
                                                    className="h-full w-full cursor-crosshair"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between border-t border-line px-5 py-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditorMode(
                                                    editorMode === 'text' ? 'draw' : 'text'
                                                )
                                            }
                                            className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition hover:text-ink"
                                        >
                                            {editorMode === 'text' ? (
                                                <PenTool size={15} />
                                            ) : (
                                                <Minimize2 size={15} />
                                            )}
                                            {editorMode === 'text' ? 'Draw' : 'Text'}
                                        </button>
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            icon={Check}
                                            onClick={handleSave}
                                        >
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <AnimatePresence>
                        {showLockPrompt ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                            >
                                <motion.div
                                    initial={{ scale: 0.92, y: 16 }}
                                    animate={{ scale: 1, y: 0 }}
                                    className="flex w-full max-w-xs flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-raised"
                                >
                                    <div className="flex items-center gap-2.5 text-base font-bold text-warn">
                                        <Lock size={19} />
                                        Security check
                                    </div>
                                    <p className="text-xs text-ink-muted">
                                        {lockAction?.type === 'lock'
                                            ? 'Set a passcode for this note.'
                                            : 'Enter the passcode to unlock.'}
                                    </p>
                                    <input
                                        type="password"
                                        autoFocus
                                        placeholder="Passcode"
                                        value={lockPasswordInput}
                                        onChange={(e) =>
                                            setLockPasswordInput(e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            e.key === 'Enter' && handleLockAction()
                                        }
                                        className="h-10 w-full rounded-control border border-line bg-sunken px-3 text-sm text-ink outline-none focus:border-line-strong"
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            className="flex-1"
                                            onClick={() => {
                                                setShowLockPrompt(false);
                                                setLockPasswordInput('');
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="primary"
                                            className="flex-1"
                                            onClick={handleLockAction}
                                        >
                                            {lockAction?.type === 'lock' ? 'Lock' : 'Open'}
                                        </Button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
};

export default SmartNotesPanel;
