import React, { useState, useRef } from 'react';
import { Camera, UploadCloud, X, Loader2, Link as LinkIcon, Plus } from 'lucide-react';
import { uploadDevicePhoto } from '../../lib/storage';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  bucket?: string;
  folder?: string;
  label?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onChange,
  maxImages = 5,
  bucket = 'campus-media',
  folder = 'lost-found',
  label = 'Photos / Images from Device',
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (images.length + files.length > maxImages) {
      setError(`You can upload a maximum of ${maxImages} images.`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          setError('Only image files (JPG, PNG, WEBP, etc.) are allowed.');
          continue;
        }

        const { url, error: uploadErr } = await uploadDevicePhoto(file, bucket, folder);
        if (uploadErr) {
          setError(uploadErr);
        } else if (url) {
          uploadedUrls.push(url);
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...images, ...uploadedUrls]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process selected photos.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddUrl = () => {
    if (!urlInputValue.trim()) return;
    if (images.length >= maxImages) {
      setError(`Maximum of ${maxImages} images allowed.`);
      return;
    }
    onChange([...images, urlInputValue.trim()]);
    setUrlInputValue('');
    setShowUrlInput(false);
  };

  const handleRemoveImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          {label} <span className="text-xs font-normal text-slate-500">({images.length}/{maxImages})</span>
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput((prev) => !prev)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 transition-colors"
        >
          <LinkIcon className="w-3.5 h-3.5" />
          {showUrlInput ? 'Hide URL input' : 'Add image via URL'}
        </button>
      </div>

      {/* Manual URL input fallback */}
      {showUrlInput && (
        <div className="flex gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 animate-in fade-in">
          <input
            type="url"
            value={urlInputValue}
            onChange={(e) => setUrlInputValue(e.target.value)}
            placeholder="Paste image link (https://...)"
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Drag & Drop / Device Upload Area */}
      {images.length < maxImages && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[0.99]'
              : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center py-3">
              <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mb-2" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Optimizing & uploading photo from device...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2 py-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-sm">
                  <UploadCloud className="w-5 h-5" />
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Choose photo from device or take photo
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Supports JPG, PNG, WEBP, HEIC (Auto-compressed)
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100/80 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                <Plus className="w-3.5 h-3.5" /> Browse Photos
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-xs text-rose-500 font-medium">{error}</p>
      )}

      {/* Image Previews Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-1">
          {images.map((imgUrl, index) => (
            <div
              key={index}
              className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm"
            >
              <img
                src={imgUrl}
                alt={`Uploaded photo ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=300&auto=format&fit=crop&q=60';
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage(index);
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white shadow-md transition-colors"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
 
