'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdsDropzone } from '@roomcommerce/ui';
import { useExifScrubber } from '@/hooks/use-exif-scrubber';
import { useWizardStore } from '@/stores/use-wizard-store';
import { createProject, uploadToR2, getApiBaseUrl } from '@/lib/api-client';

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
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* ── Wizard step indicator ────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8" aria-label="Upload wizard — step 1 of 3">
        <StepBadge step={1} label="Upload" active />
        <StepDivider />
        <StepBadge step={2} label="Review" />
        <StepDivider />
        <StepBadge step={3} label="Configure" />
      </div>

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
        <p
          role="alert"
          data-testid="quality-error-alert"
          className="mt-4 text-sm text-status-danger font-medium"
        >
          {errorMessage}
        </p>
      )}

      {uploadState === 'scrubbing' && (
        <p className="mt-4 text-sm text-ink-muted">
          Removing EXIF metadata from your photo…
        </p>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          id="upload-continue-btn"
          disabled={uploadState !== 'done'}
          onClick={() => router.push('/studio/new/inspect')}
          className="px-6 py-2.5 rounded-lg bg-brand-terracotta text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function StepBadge({
  step,
  label,
  active = false,
}: {
  step: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          active
            ? 'bg-brand-terracotta text-white'
            : 'bg-border-default text-ink-muted'
        }`}
        aria-current={active ? 'step' : undefined}
      >
        {step}
      </span>
      <span className={`text-sm font-medium ${active ? 'text-ink-primary' : 'text-ink-muted'}`}>
        {label}
      </span>
    </div>
  );
}

function StepDivider() {
  return <div className="flex-1 h-px bg-border-default mx-1" aria-hidden="true" />;
}
