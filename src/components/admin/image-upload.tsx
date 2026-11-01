'use client';

import { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useStorage } from '@/firebase';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { X, UploadCloud } from 'lucide-react';

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}

export function ImageUpload({ label, value, onChange, folder = 'towns' }: ImageUploadProps) {
  const storage = useStorage();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }

    setUploading(true);
    setProgress(0);

    const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setProgress(pct);
      },
      (err) => {
        console.error('Upload failed:', err);
        setError('Upload failed. Please try again.');
        setUploading(false);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        onChange(url);
        setUploading(false);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = '';
      }
    );
  };

  const handleRemove = () => {
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {/* Preview */}
      {value && !uploading && (
        <div className="relative w-full h-40 rounded-lg overflow-hidden border">
          <Image src={value} alt={label} fill sizes="50vw" className="object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload area */}
      {!value && (
        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition">
          <input
            ref={inputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 w-3/4">
              <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <UploadCloud className="h-8 w-8" />
              <p className="text-sm">Click to upload image</p>
              <p className="text-xs">PNG, JPG, WEBP up to 5MB</p>
            </div>
          )}
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
