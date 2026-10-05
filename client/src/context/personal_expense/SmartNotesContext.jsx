import { createContext, useContext, useState, useEffect } from 'react';

const SmartNotesContext = createContext();

export const useSmartNotes = () => {
    return useContext(SmartNotesContext);
};

export const SmartNotesProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [notes, setNotes] = useState(() => {
        try {
            const saved = localStorage.getItem('pem-smart-notes');
            // Deduplicate on load just in case
            const parsed = saved ? JSON.parse(saved) : [];
            const unique = [];
            const ids = new Set();
            parsed.forEach(n => {
                if (!ids.has(n.id)) {
                    ids.add(n.id);
                    unique.push(n);
                }
            });
            return unique;
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('pem-smart-notes', JSON.stringify(notes));
    }, [notes]);

    const openNotes = () => setIsOpen(true);
    const closeNotes = () => {
        if (!isPinned) setIsOpen(false);
    };
    const togglePin = () => setIsPinned(prev => !prev);

    // Note Management
    const addNote = (note) => {
        setNotes(prev => {
            if (prev.some(n => n.id === note.id)) return prev; // Prevent duplicates
            return [note, ...prev];
        });
    };

    const updateNote = (id, updates) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    };

    const deleteNote = (id) => {
        setNotes(prev => prev.filter(n => n.id !== id));
    };

    const archiveNote = (id) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, isArchived: true, isTrashed: false } : n));
    };

    const unarchiveNote = (id) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, isArchived: false } : n));
    };

    const trashNote = (id) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, isTrashed: true } : n));
    };

    const restoreNote = (id) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, isTrashed: false } : n));
    };

    const lockNote = (id, password) => {
        setNotes(prev => prev.map(n => {
            if (n.id === id) {
                // If already locked, unlock (remove password and isLocked)
                // Wait, user might want to just UNLOCK.
                // Logic: If isLocked is true, we need to verify password before unlocking. 
                // But this function just SETS the state. The UI calculates validity.
                // Actually, let's make this toggle based on intention.
                // If providing a password, we are LOCKING it. 
                // If unlocking, we effectively set isLocked: false.

                if (n.isLocked) {
                    return { ...n, isLocked: false, lockPassword: null };
                } else {
                    return { ...n, isLocked: true, lockPassword: password };
                }
            }
            return n;
        }));
    };

    const value = {
        isOpen,
        setIsOpen,
        isPinned,
        setIsPinned,
        openNotes,
        closeNotes,
        togglePin,
        notes,
        addNote,
        updateNote,
        deleteNote,
        archiveNote,
        unarchiveNote,
        trashNote,
        restoreNote,
        lockNote
    };

    return (
        <SmartNotesContext.Provider value={value}>
            {children}
        </SmartNotesContext.Provider>
    );
};
