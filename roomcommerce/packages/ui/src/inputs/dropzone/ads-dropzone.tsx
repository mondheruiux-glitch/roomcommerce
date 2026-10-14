'use client';
import * as React from 'react';
import { Upload, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

type DropzoneState = 'idle' | 'drag-over' | 'uploading' | 'error' | 'success';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const MAX_BYTES = 20 * 1024 * 1024; // 20MB (FR-101)

export interface AdsDropzoneProps {
  onFileAccepted: (file: File) => void;
  onError?: (message: string) => void;
  uploadProgress?: number; // 0-100 when uploading
  isUploading?: boolean;
  className?: string;
}

/**
 * AdsDropzone — Drag-and-drop room photo intake (FR-101).
 * Accepts: JPG, PNG, HEIC. Limit: 20MB.
 * States: idle, drag-over (terracotta dashed), uploading (circular progress), error, success.
 * Includes GDPR/CCPA trust assurance badge.
 */
export function AdsDropzone({
  onFileAccepted,
  onError,
  uploadProgress = 0,
  isUploading = false,
  className,
}: AdsDropzoneProps) {
  const [state, setState] = React.useState<DropzoneState>('idle');
  const [errorMsg, setErrorMsg] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  function validateAndAccept(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(heic|heif)$/i)) {
      const msg = 'Please upload a JPG, PNG, or HEIC photo.';
      setState('error');
      setErrorMsg(msg);
      onError?.(msg);
      return;
    }
    if (file.size > MAX_BYTES) {
      const msg = 'Photo must be under 20MB.';
      setState('error');
      setErrorMsg(msg);
      onError?.(msg);
      return;
    }
    setErrorMsg('');
    setState('idle');
    onFileAccepted(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) validateAndAccept(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndAccept(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  const currentState: DropzoneState = isUploading ? 'uploading' : state;

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setState('drag-over'); }}
        onDragLeave={() => setState('idle')}
        onDrop={handleDrop}
        aria-label="Upload room photo. Drag and drop or click to browse"
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center',
          'transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2',
          'min-h-[180px]',
          currentState === 'drag-over' && 'border-brand-terracotta bg-brand-terracotta-subtle',
          currentState === 'idle' && 'border-border-default bg-bg-canvas hover:border-border-strong hover:bg-bg-subtle',
          currentState === 'uploading' && 'border-border-default bg-bg-subtle cursor-not-allowed',
          currentState === 'error' && 'border-semantic-danger bg-semantic-danger-subtle',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
          onChange={handleChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        {currentState === 'uploading' ? (
          <>
            <Loader2 className="w-8 h-8 text-brand-terracotta animate-spin" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink-primary">Uploading your photo…</p>
              <div
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-40 h-1.5 bg-border-default rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-brand-terracotta rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-ink-muted font-mono">{uploadProgress}%</p>
            </div>
          </>
        ) : currentState === 'error' ? (
          <>
            <AlertCircle className="w-8 h-8 text-semantic-danger" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-semantic-danger">{errorMsg}</p>
              <p className="text-xs text-ink-muted mt-1">Click to try again</p>
            </div>
          </>
        ) : (
          <>
            <Upload
              className={cn(
                'w-8 h-8 transition-colors duration-200',
                currentState === 'drag-over' ? 'text-brand-terracotta' : 'text-ink-muted',
              )}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-ink-primary">
                {currentState === 'drag-over'
                  ? 'Drop your room photo here'
                  : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-ink-muted mt-1">JPG, PNG, HEIC · max 20 MB</p>
            </div>
          </>
        )}
      </div>

      {/* GDPR/CCPA Trust Assurance Badge */}
      <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        <ShieldCheck className="w-3.5 h-3.5 text-semantic-success shrink-0" aria-hidden="true" />
        <span>Photos permanently deleted after 7 days (GDPR/CCPA compliant)</span>
      </div>
    </div>
  );
}
