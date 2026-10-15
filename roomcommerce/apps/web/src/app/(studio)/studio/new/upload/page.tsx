'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdsDropzone } from '@roomcommerce/ui';
import { useExifScrubber } from '@/hooks/use-exif-scrubber';
import { useWizardStore } from '@/stores/use-wizard-store';
import { createProject, uploadToR2, getApiBaseUrl } from '@/lib/api-client';
import { WizardProgress } from '@/components/wizard/wizard-progress';

const WIZARD_STEPS = ['Upload', 'Review', 'Configure'];

type UploadState = 'idle' | 'scrubbing' | 'uploading' | 'done' | 'error';

export default function UploadPage() {
  const router = useRouter();
  const { scrub } = useExifScrubber();
  const { setRawImage, setProjectId } = useWizardStore();

  const [uploadState, setUploadState] = React.useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleFileAccepted(file: File) {
    setErrorMessage(null);
    setUploadState('scrubbing');

    try {
      // Step 1: Strip EXIF/GPS metadata on-device (FR-102)
      const sanitizedBlob = await scrub(file);
      if (!sanitizedBlob) throw new Error('Failed to sanitize image');

      const previewUrl = URL.createObjectURL(sanitizedBlob);
      setRawImage(file, sanitizedBlob, previewUrl);

      // Step 2: Quality Gate / Inspect check (FR-105)
      try {
        const inspectRes = await fetch(`${getApiBaseUrl()}/api/v1/inspect`, {
          method: 'POST',
          body: sanitizedBlob,
        });
        if (inspectRes.status === 422) {
          const errData = await inspectRes.json().catch(() => ({}));
          throw new Error(
            errData.message ||
              errData.error ||
              'This image does not appear to be an interior room. Please upload a photo of your living space.',
          );
        }
      } catch (inspectErr) {
        if (inspectErr instanceof Error && !inspectErr.message.includes('fetch')) {
          throw inspectErr;
        }
      }

      // Step 3: Create project + get presigned R2 upload URL
      setUploadState('uploading');
      setUploadProgress(10);

      const { projectId, uploadUrl } = await createProject();
      setProjectId(projectId);

      // Step 4: Direct PUT to Cloudflare R2 (no API intermediary)
      setUploadProgress(40);
      await uploadToR2(uploadUrl, sanitizedBlob);
      setUploadProgress(100);

      setUploadState('done');
      router.push('/studio/new/inspect');
    } catch (err) {
      console.error('[UploadPage]', err);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploadState('error');
    }
  }

  function handleError(msg: string) {
    setErrorMessage(msg);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 animate-fade-up">
      <WizardProgress currentStep={1} steps={WIZARD_STEPS} ariaLabel="Upload wizard — step 1 of 3" />

      <h1 className="text-2xl font-bold text-ink-primary mb-2">Upload Your Room Photo</h1>
      <p className="text-ink-secondary text-sm mb-8">
        Your photo is processed privately on your device before upload — GPS and
        camera data are automatically removed (FR-102).
      </p>

      <div data-testid="dropzone-area">
        <AdsDropzone
          onFileAccepted={handleFileAccepted}
          onError={handleError}
          isUploading={uploadState === 'uploading' || uploadState === 'scrubbing'}
          uploadProgress={uploadProgress}
        />
      </div>

      {errorMessage && (
        <div
          role="alert"
          data-testid="quality-error-alert"
          className="mt-4 flex items-start gap-2.5 p-3 rounded-lg bg-status-danger/8 border border-status-danger/20"
        >
          <span className="text-status-danger mt-0.5 shrink-0" aria-hidden="true">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-status-danger font-medium">{errorMessage}</p>
            <button
              type="button"
              onClick={() => { setErrorMessage(null); setUploadState('idle'); }}
              className="mt-1 text-xs text-status-danger/70 underline hover:text-status-danger transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {uploadState === 'scrubbing' && (
        <p className="mt-4 text-sm text-ink-muted flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-brand-terracotta border-t-transparent animate-spin" aria-hidden="true" />
          Removing EXIF metadata from your photo…
        </p>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          id="upload-continue-btn"
          disabled={uploadState !== 'done'}
          onClick={() => router.push('/studio/new/inspect')}
          className="px-6 py-2.5 rounded-lg bg-brand-terracotta text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-terracotta-hover transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}


