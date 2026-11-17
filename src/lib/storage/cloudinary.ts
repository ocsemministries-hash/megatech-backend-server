import crypto from 'node:crypto';
import { ENV } from '@/config/env';

/** Sub-folders a browser upload may target; everything stays under CLOUDINARY_UPLOAD_FOLDER. */
export const CLOUDINARY_UPLOAD_SUBFOLDERS = ['media', 'thumbnails', 'avatars', 'payments', 'documents'] as const;

export type CloudinaryUploadSubfolder = (typeof CLOUDINARY_UPLOAD_SUBFOLDERS)[number];

export type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
}

/** Signs Cloudinary upload params: sha1 of the sorted `k=v&…` string plus the API secret. No SDK needed. */
export const signUploadParams = (
  params: Record<string, string | number>,
  secret: string = ENV.CLOUDINARY_API_SECRET
): string => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(payload + secret).digest('hex');
};

const resolveFolder = (subfolder?: string): string => {
  const base = ENV.CLOUDINARY_UPLOAD_FOLDER;
  if (!subfolder) return base;
  if (!(CLOUDINARY_UPLOAD_SUBFOLDERS as readonly string[]).includes(subfolder)) {
    throw new Error(
      `Invalid upload folder "${subfolder}". Allowed: ${CLOUDINARY_UPLOAD_SUBFOLDERS.join(', ')}.`
    );
  }
  return `${base}/${subfolder}`;
};

/** Builds a short-lived signed-upload grant (timestamp + forced folder); file bytes go browser → Cloudinary. */
export const buildUploadSignature = (
  opts: { folder?: string; resourceType: CloudinaryResourceType },
  now: Date = new Date()
): UploadSignature => {
  const timestamp = Math.floor(now.getTime() / 1000);
  const folder = resolveFolder(opts.folder);
  const signature = signUploadParams({ folder, timestamp });
  return {
    cloudName: ENV.CLOUDINARY_CLOUD_NAME,
    apiKey: ENV.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${ENV.CLOUDINARY_CLOUD_NAME}/${opts.resourceType}/upload`,
  };
};

/** True when the URL is a delivery URL from our own Cloudinary cloud. */
export const isOwnCloudinaryUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${ENV.CLOUDINARY_CLOUD_NAME}/`)
    );
  } catch {
    return false;
  }
};

/** Extracts the asset public_id from one of our delivery URLs (null when it is not ours). */
export const extractPublicId = (url: string): string | null => {
  if (!isOwnCloudinaryUrl(url)) return null;
  try {
    const pathname = new URL(url).pathname;
    const marker = '/upload/';
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    let rest = pathname.slice(markerIndex + marker.length).replace(/^v\d+\//, '');
    if (!rest) return null;
    const dotIndex = rest.lastIndexOf('.');
    if (dotIndex > 0) rest = rest.slice(0, dotIndex);
    return rest || null;
  } catch {
    return null;
  }
};
