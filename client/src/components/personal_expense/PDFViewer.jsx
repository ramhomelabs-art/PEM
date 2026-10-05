import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, ZoomIn, ZoomOut, Download, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '../ui/primitives';
import { cx } from '../ui/cx';

// The worker is served from public/ by the app shell.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const PAGE_WIDTH = 720;

/**
 * Password-gated PDF viewer used by the Accounts & Documents page.
 *
 * `password` is forwarded to pdf.js so encrypted statements open without a
 * separate round trip; on a wrong password the viewer asks again rather than
 * failing silently.
 */
const PDFViewer = ({ fileUrl, fileName, password = '', onClose }) => {
    const [numPages, setNumPages] = useState(null);
    const [page, setPage] = useState(1);
    const [scale, setScale] = useState(1);
    const [needsPassword, setNeedsPassword] = useState(false);
    const [entry, setEntry] = useState(password);
    const [error, setError] = useState(null);

    const onLoadError = (err) => {
        if (err?.name === 'PasswordException') {
            setNeedsPassword(true);
            return;
        }
        setError(err?.message || 'This document could not be opened.');
    };

    const submitPassword = (event) => {
        event.preventDefault();
        setNeedsPassword(false);
        setError(null);
        // Bumping the page resets the pdf.js document with the new credential.
        setPage(1);
        setNumPages(null);
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-card border border-line bg-bg shadow-raised">
                <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                        {fileName}
                    </p>

                    {numPages ? (
                        <div className="flex items-center gap-1 text-ink-muted">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
                                aria-label="Zoom out"
                            >
                                <ZoomOut size={15} />
                            </Button>
                            <span className="tnum px-1 text-xs font-semibold">
                                {page} / {numPages}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setScale((s) => Math.min(3, s + 0.15))}
                                aria-label="Zoom in"
                            >
                                <ZoomIn size={15} />
                            </Button>
                        </div>
                    ) : null}

                    <a
                        href={fileUrl}
                        download={fileName}
                        title="Download"
                        aria-label="Download document"
                        className="grid h-8 w-8 place-items-center rounded-control text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                    >
                        <Download size={15} />
                    </a>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close viewer"
                        className="grid h-8 w-8 place-items-center rounded-control text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                    >
                        <X size={16} />
                    </button>
                </header>

                <div className="pem-scroll flex-1 overflow-auto bg-sunken p-4">
                    {error ? (
                        <p className="rounded-control bg-neg-soft p-3 text-center text-xs font-semibold text-neg">
                            {error}
                        </p>
                    ) : null}

                    <Document
                        file={fileUrl}
                        password={entry}
                        onLoadSuccess={({ numPages: total }) => {
                            setNumPages(total);
                            setError(null);
                        }}
                        onLoadError={onLoadError}
                        loading={
                            <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
                                <Loader2 size={16} className="animate-spin" />
                                Loading document…
                            </div>
                        }
                        error={
                            <p className="py-16 text-center text-sm text-ink-muted">
                                Unable to load this file.
                            </p>
                        }
                        className="flex flex-col items-center gap-4"
                    >
                        {Array.from({ length: numPages ?? 0 }, (_, index) => (
                            <Page
                                key={index + 1}
                                pageNumber={index + 1}
                                width={PAGE_WIDTH * scale}
                                renderAnnotationLayer={false}
                                renderTextLayer={false}
                                onRenderSuccess={() => setPage(index + 1)}
                                loading={
                                    <div className="pem-skeleton h-[900px] w-full max-w-2xl" />
                                }
                                className={cx(
                                    'overflow-hidden rounded-md shadow-card',
                                    'bg-white'
                                )}
                            />
                        ))}
                    </Document>

                    {needsPassword ? (
                        <form
                            onSubmit={submitPassword}
                            className="mx-auto mt-4 flex max-w-sm flex-col gap-3 rounded-card border border-line bg-surface p-4"
                        >
                            <p className="text-xs font-semibold text-ink-muted">
                                This document is password protected.
                            </p>
                            <div className="relative">
                                <KeyRound
                                    size={15}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                                />
                                <input
                                    type="password"
                                    value={entry}
                                    onChange={(e) => setEntry(e.target.value)}
                                    placeholder="Document password"
                                    autoFocus
                                    className="w-full rounded-control border border-line bg-input py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand"
                                />
                            </div>
                            <Button type="submit" variant="primary">
                                Open document
                            </Button>
                        </form>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default PDFViewer;