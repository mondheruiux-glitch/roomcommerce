'use client';
import { useState, useCallback } from 'react';
import { stripExifMetadata } from '../lib/exif-scrubber';

export type ExifScrubberStatus = 'idle' | 'scrubbing' | 'done' | 'error';

export interface UseExifScrubberResult {
  status: ExifScrubberStatus;
  sanitizedBlob: Blob | null;
  previewUrl: string | null;
  error: string | null;
  scrub: (file: File) => Promise<Blob | null>;
  reset: () => void;
}

/**
 * useExifScrubber — React hook wrapping the stripExifMetadata utility.
 * Manages loading state, preview URL lifecycle, and error handling.
 *
 * Requirements: FR-102, SEC-02
 */
export function useExifScrubber(): UseExifScrubberResult {
  const [status, setStatus] = useState<ExifScrubberStatus>('idle');
  const [sanitizedBlob, setSanitizedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrub = useCallback(async (file: File): Promise<Blob | null> => {
    setStatus('scrubbing');
    setError(null);

    try {
      const blob = await stripExifMetadata(file);
      const url = URL.createObjectURL(blob);
      setSanitizedBlob(blob);
      setPreviewUrl(url);
      setStatus('done');
      return blob;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to sanitize image metadata';
      setError(message);
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStatus('idle');
    setSanitizedBlob(null);
    setPreviewUrl(null);
    setError(null);
  }, [previewUrl]);

  return { status, sanitizedBlob, previewUrl, error, scrub, reset };
}
