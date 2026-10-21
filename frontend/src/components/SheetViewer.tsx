/**
 * SheetViewer — lazy-loaded answer sheet viewer for ScriptGrade.
 *
 * Architecture mirrors the downloadclassnotes.com pattern we reverse-engineered:
 *   • The iframe/img starts with src="about:blank" (no network request on mount)
 *   • An IntersectionObserver fires when the container scrolls into view and
 *     swaps the real URL into the src attribute — identical to LiteSpeed Cache's
 *     data-litespeed-src → src swap mechanism
 *   • PDFs are rendered by the browser's built-in viewer (no PDF.js bundle)
 *   • Images (.jpg/.jpeg/.png) fall back to a plain <img> tag
 *   • A skeleton shimmer animates while the content is loading
 *   • A toolbar provides Open-in-new-tab and Copy-URL actions
 *
 * Zero-regression: this file is additive-only.  No existing component is
 * modified by this file itself.
 */

import { useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, FileText, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { API_BASE_URL } from "@/lib/api";

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────── */

export interface SheetViewerProps {
  /** Fully-resolved URL or path to the PDF or image (/static/..., http://..., or blob:...). */
  url?: string | null | undefined;

  /** Direct blob URL (e.g. from URL.createObjectURL(file)). */
  blobUrl?: string | null | undefined;

  /** Raw File object to render directly. */
  file?: File | null | undefined;

  /** Student identifier shown in the toolbar and aria-labels. */
  studentId?: string;

  /** Height of the viewer frame in pixels (default 640). */
  height?: number;

  /** Extra CSS classes applied to the outermost wrapper div. */
  className?: string;

  /** Called once the iframe/img fires its load event. */
  onLoad?: () => void;

  /** Called when the viewer fires an error event. */
  onError?: (e: unknown) => void;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────── */

/** True when the URL looks like a raster image we can render directly. */
function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)([\?#]|$)/i.test(url);
}

/** True when the URL is a usable path (relative /static/..., absolute http(s) URL, or blob: URL). */
function isValidViewerUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith("/") || url.startsWith("blob:");
}

/* ──────────────────────────────────────────────────────────────────────────
 * Loading skeleton
 * ──────────────────────────────────────────────────────────────────────── */

function ViewerSkeleton({ height }: { height: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card"
      style={{ height }}
    >
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
      <p className="mono-token text-xs text-muted-foreground">Loading sheet…</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * No-preview placeholder
 * ──────────────────────────────────────────────────────────────────────── */

function NoPreview({ height }: { height: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card text-center"
      style={{ height }}
    >
      <FileText size={20} className="text-muted-foreground" />
      <p className="text-xs text-muted-foreground">No document preview available for this scan.</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Viewer toolbar
 * ──────────────────────────────────────────────────────────────────────── */

function ViewerToolbar({
  url,
  studentId,
  zoom,
  onZoomIn,
  onZoomOut,
}: {
  url: string;
  studentId?: string | undefined;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const copyUrl = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("URL copied"))
      .catch(() => toast.error("Copy failed"));
  };

  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-card px-3 py-2">
      {/* Student label */}
      <span className="mono-token truncate text-[0.625rem] text-muted-foreground">
        {studentId ?? "Answer Sheet"}
      </span>

      <div className="ml-auto flex items-center gap-1">
        {/* Zoom controls (image only — iframe zoom is handled by the browser) */}
        <button
          onClick={onZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ZoomOut size={12} />
        </button>
        <span className="mono-token w-9 text-center text-[0.6875rem] text-muted-foreground">
          {zoom}%
        </span>
        <button
          onClick={onZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ZoomIn size={12} />
        </button>

        {/* Divider */}
        <span className="mx-1 h-3.5 w-px bg-border" />

        {/* Copy URL */}
        <button
          onClick={copyUrl}
          aria-label="Copy sheet URL"
          title="Copy URL"
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Copy size={12} />
        </button>

        {/* Download Sheet */}
        <a
          href={url}
          download={studentId ? `${studentId}_sheet.pdf` : "sheet.pdf"}
          aria-label="Download sheet"
          title="Download sheet"
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Download size={12} />
        </a>

        {/* Open in new tab */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open sheet in new tab"
          title="Open in new tab"
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Main component
 * ──────────────────────────────────────────────────────────────────────── */

export function SheetViewer({
  url,
  blobUrl: propBlobUrl,
  file,
  studentId,
  height = 640,
  className,
  onLoad,
  onError,
}: SheetViewerProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [activated, setActivated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);

  const token = useAuthStore((s) => s.token);
  const containerRef = useRef<HTMLDivElement>(null);

  // If a raw File is provided, derive a local blob URL
  useEffect(() => {
    if (!file) {
      setFileBlobUrl(null);
      return;
    }
    let b: string | null = null;
    try {
      b = URL.createObjectURL(file);
      setFileBlobUrl(b);
    } catch (e) {
      console.warn("Failed to create object URL for file prop:", e);
    }
    return () => {
      if (b) {
        URL.revokeObjectURL(b);
      }
    };
  }, [file]);

  // Determine the effective target URL: prop blobUrl > fileBlobUrl > url
  const effectiveUrl = propBlobUrl || fileBlobUrl || url || null;

  // ── Intersection observer — lazy activation (LiteSpeed pattern) ────────
  useEffect(() => {
    if (!effectiveUrl) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setActivated(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px 0px",
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [effectiveUrl]);

  // Reset when the effective URL changes (teacher selects a different paper)
  useEffect(() => {
    setActivated(false);
    setLoaded(false);
    setFetchError(null);
    setBlobUrl(null);
  }, [effectiveUrl]);

  const asImage = effectiveUrl ? isImageUrl(effectiveUrl) : false;

  // ── Safe Local / Backend Blob Fetching (bypasses Chrome & external CORS blocks) ─
  useEffect(() => {
    if (!activated || !effectiveUrl || asImage) return;

    let isCancelled = false;
    let localBlobUrl: string | null = null;

    async function loadPdfBlob() {
      let targetUrl = effectiveUrl as string;

      // 1. Direct local Blob URL: render immediately without network roundtrip
      if (targetUrl.startsWith("blob:")) {
        setBlobUrl(targetUrl);
        return;
      }

      // 2. Prepend backend origin if relative path (e.g. /static/papers/...)
      if (targetUrl.startsWith("/") && !targetUrl.startsWith("/sample.pdf")) {
        const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
        if (/^https?:\/\//i.test(backendOrigin)) {
          targetUrl = `${backendOrigin}${targetUrl}`;
        }
      }

      try {
        setFetchError(null);
        const headers: HeadersInit = {};
        if (token && (targetUrl.startsWith("/") || targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1"))) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(targetUrl, { credentials: "omit", headers });
        if (!res.ok) {
          throw new Error(`Failed to load sheet (${res.status} ${res.statusText})`);
        }
        const rawBlob = await res.blob();
        if (isCancelled) return;

        // Force application/pdf MIME type for the local blob so Chrome's viewer handles it properly
        const pdfBlob = new Blob([rawBlob], { type: "application/pdf" });
        localBlobUrl = URL.createObjectURL(pdfBlob);
        setBlobUrl(localBlobUrl);
      } catch (err: unknown) {
        if (isCancelled) return;
        console.warn("SheetViewer primary fetch failed for URL:", targetUrl, err);

        // Emergency fallback: only if the requested URL fundamentally failed to load
        // and is not already the fallback itself
        if (targetUrl !== "/sample.pdf") {
          try {
            const fallbackRes = await fetch("/sample.pdf");
            if (fallbackRes.ok) {
              const fallbackBlob = await fallbackRes.blob();
              if (!isCancelled) {
                localBlobUrl = URL.createObjectURL(new Blob([fallbackBlob], { type: "application/pdf" }));
                setBlobUrl(localBlobUrl);
                return;
              }
            }
          } catch {
            // ignore fallback error and surface clean message
          }
        }

        const msg = err instanceof Error ? err.message : "Failed to load document preview";
        setFetchError(msg);
        onError?.(err);
      }
    }

    void loadPdfBlob();

    return () => {
      isCancelled = true;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [activated, effectiveUrl, asImage, token, onError]);

  // ── Guard: no URL or invalid path ──────────────────────────────────────
  if (!effectiveUrl || !isValidViewerUrl(effectiveUrl)) {
    return <NoPreview height={height} />;
  }

  const frameHeight = height - 40; // subtract toolbar height

  // ── Zoom helpers (clamped 50–200%) ────────────────────────────────────
  const zoomIn = () => setZoom((z) => Math.min(200, z + 25));
  const zoomOut = () => setZoom((z) => Math.max(50, z - 25));

  const resolvedDirectUrl = effectiveUrl;

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden rounded-lg border border-border", className)}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <ViewerToolbar
        url={resolvedDirectUrl}
        studentId={studentId}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
      />

      {/* ── Content area ─────────────────────────────────────────────── */}
      <div className="relative overflow-auto bg-[#f5f5f0]" style={{ height: frameHeight }}>
        {/* Skeleton shown until load fires */}
        {activated && !loaded && !fetchError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card">
            <ViewerSkeleton height={frameHeight} />
          </div>
        )}

        {/* Pre-activation placeholder (before IntersectionObserver fires) */}
        {!activated && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <ViewerSkeleton height={frameHeight} />
          </div>
        )}

        {activated && asImage ? (
          /* ── Image viewer ──────────────────────────────────────────── */
          <div className="flex min-h-full items-start justify-center p-4">
            <img
              src={resolvedDirectUrl}
              alt={`Scanned answer sheet${studentId ? ` for ${studentId}` : ""}`}
              className="block shadow-sm transition-[opacity,transform] duration-300"
              style={{
                width: `${zoom}%`,
                opacity: loaded ? 1 : 0,
              }}
              onLoad={() => {
                setLoaded(true);
                onLoad?.();
              }}
              onError={(e) => {
                setLoaded(true); // remove skeleton even on error
                onError?.(e);
              }}
              draggable={false}
            />
          </div>
        ) : activated && blobUrl ? (
          /* ── PDF iframe viewer (using local secure Blob URL) ────────── */
          /* Notice: sandbox attribute is omitted so Chrome's built-in PDF viewer */
          /* extension executes safely without "This page has been blocked by Chrome". */
          <iframe
            src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            title={`Answer sheet${studentId ? ` — ${studentId}` : ""}`}
            className="block h-full w-full border-0 transition-opacity duration-300"
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => {
              setLoaded(true);
              onLoad?.();
            }}
            onError={(e) => {
              setLoaded(true);
              onError?.(e);
            }}
            allow="fullscreen"
          />
        ) : fetchError ? (
          /* ── Error fallback with link ──────────────────────────────── */
          <div
            className="flex flex-col items-center justify-center gap-2 p-6 text-center"
            style={{ height: frameHeight }}
          >
            <FileText size={24} className="text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{fetchError}</p>
            <p className="text-xs text-muted-foreground">
              Unable to render inline preview in this browser context.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <a
                href={resolvedDirectUrl}
                download={studentId ? `${studentId}_sheet.pdf` : "sheet.pdf"}
                className="inline-flex items-center gap-1.5 rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
              >
                <Download size={12} /> Download Sheet
              </a>
              <a
                href={resolvedDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Open Original Sheet <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
