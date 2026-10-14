/**
 * stripExifMetadata — Client-side EXIF/GPS/device-telemetry sanitizer.
 *
 * Strips all metadata by drawing the raw image onto an offscreen HTML5 Canvas
 * and re-exporting a clean binary Blob. The Canvas API never carries EXIF
 * segments in its export output, making this approach immune to partial-strip
 * failures that plague library-based tag deletion.
 *
 * Requirements: FR-102, SEC-02
 *
 * @param file - Original user-supplied image File (JPEG, PNG, HEIC, HEIF)
 * @returns A clean Blob with all EXIF, GPS, and camera-serial tags removed.
 */
export async function stripExifMetadata(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // HEIC/HEIF: re-export as JPEG since Canvas cannot read HEIC natively on all browsers
    const outputType =
      file.type === 'image/png' ? 'image/png' : 'image/jpeg';

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl); // Immediately release the object URL

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('[EXIF Scrubber] Failed to acquire 2D canvas context'));
        return;
      }

      // Drawing naturally discards all EXIF/IPTC/XMP metadata segments
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('[EXIF Scrubber] Failed to create sanitized Blob from canvas'));
          }
        },
        outputType,
        0.95, // Quality: 95% — preserves visual fidelity while discarding metadata
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('[EXIF Scrubber] Failed to decode image file — unsupported format or corrupt data'));
    };

    img.src = objectUrl;
  });
}
