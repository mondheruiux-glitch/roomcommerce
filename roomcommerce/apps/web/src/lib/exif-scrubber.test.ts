import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stripExifMetadata } from '../lib/exif-scrubber';

// ── Canvas API mocks ─────────────────────────────────────────────────────────
// jsdom does not implement HTMLCanvasElement.toBlob or getContext
const mockBlob = new Blob(['clean-image-data'], { type: 'image/jpeg' });
const mockCtx = { drawImage: vi.fn() };

beforeEach(() => {
  mockCtx.drawImage.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    mockCtx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    function (callback, _type) {
      // Simulate async canvas export
      setTimeout(() => callback(mockBlob), 0);
    },
  );

  // Mock Image loading
  vi.spyOn(global, 'Image').mockImplementation(() => {
    const img = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
      naturalWidth: 1920,
      naturalHeight: 1080,
    };
    // Auto-trigger onload when src is set
    Object.defineProperty(img, 'src', {
      set(_url: string) {
        setTimeout(() => img.onload?.(), 0);
      },
    });
    return img as unknown as HTMLImageElement;
  });
});

describe('stripExifMetadata', () => {
  it('returns a Blob from a JPEG file', async () => {
    const file = new File(['fake-jpeg-data'], 'room.jpg', { type: 'image/jpeg' });
    const result = await stripExifMetadata(file);
    expect(result).toBeInstanceOf(Blob);
  });

  it('calls drawImage on the canvas context (stripping EXIF via re-encode)', async () => {
    const file = new File(['fake-jpeg-data'], 'room.jpg', { type: 'image/jpeg' });
    await stripExifMetadata(file);
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('uses image/png output type for PNG input', async () => {
    const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (callback, type) {
        // Capture the type argument
        toBlobSpy.mock.calls; // just to retain ref
        setTimeout(() => callback(new Blob(['png-data'], { type: type ?? 'image/png' })), 0);
      },
    );

    const file = new File(['fake-png-data'], 'room.png', { type: 'image/png' });
    await stripExifMetadata(file);

    // The first argument to toBlob after callback is the MIME type
    const callArgs = toBlobSpy.mock.calls[0]!;
    expect(callArgs[1]).toBe('image/png');
  });

  it('uses image/jpeg output type for HEIC input (browser fallback)', async () => {
    const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (callback, type) {
        setTimeout(() => callback(new Blob(['jpeg-data'], { type: type ?? 'image/jpeg' })), 0);
      },
    );

    const file = new File(['fake-heic-data'], 'room.heic', { type: 'image/heic' });
    await stripExifMetadata(file);

    const callArgs = toBlobSpy.mock.calls[0]!;
    expect(callArgs[1]).toBe('image/jpeg');
  });

  it('rejects when canvas context is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const file = new File(['data'], 'room.jpg', { type: 'image/jpeg' });
    await expect(stripExifMetadata(file)).rejects.toThrow('Failed to acquire 2D canvas context');
  });

  it('rejects when canvas.toBlob returns null', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (callback) {
        setTimeout(() => callback(null), 0);
      },
    );

    const file = new File(['data'], 'room.jpg', { type: 'image/jpeg' });
    await expect(stripExifMetadata(file)).rejects.toThrow('Failed to create sanitized Blob');
  });
});
