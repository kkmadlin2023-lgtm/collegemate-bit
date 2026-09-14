import { supabase } from './supabase';

/**
 * Compresses an image file on the client before upload to save bandwidth and storage.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ blob: file, dataUrl: event.target?.result as string });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              resolve({ blob: file, dataUrl: event.target?.result as string });
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image file.'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a photo selected from the user's device directly to Supabase Storage.
 * If the bucket is not yet created in Supabase, automatically falls back to compressed Base64 Data URL
 * so item reporting NEVER fails.
 */
export async function uploadDevicePhoto(
  file: File,
  bucket = 'campus-media',
  folder = 'lost-found'
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  try {
    // 1. Compress image client-side first
    const { blob, dataUrl } = await compressImage(file);

    // 2. Build unique filepath
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // 3. Attempt Supabase Storage upload
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: blob.type || 'image/jpeg',
      });

    if (uploadError || !uploadData) {
      console.warn(
        `Supabase Storage bucket "${bucket}" unavailable (${uploadError?.message}). Using compressed base64 fallback.`
      );
      // Seamless fallback to compressed base64 Data-URI
      return { url: dataUrl, error: null };
    }

    // 4. Retrieve public URL
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return { url: publicData.publicUrl || dataUrl, error: null };
  } catch (err: any) {
    console.error('Error uploading device photo:', err);
    return { url: null, error: err.message || 'Failed to upload image' };
  }
}
 
