import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'demo-cloud');
  vi.stubEnv('CLOUDINARY_API_KEY', 'test-key');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret-123');
  vi.stubEnv('CLOUDINARY_UPLOAD_FOLDER', 'megatech/media');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const loadCloudinary = () => import('@/lib/storage/cloudinary');

describe('signUploadParams', () => {
  it('signs the sorted k=v string plus the secret (fixed vector)', async () => {
    const { signUploadParams } = await loadCloudinary();

    // Keys deliberately unsorted: the vector pins alphabetical ordering.
    const signature = signUploadParams(
      { timestamp: 1728000000, folder: 'megatech/media/thumbnails' },
      'test-secret-123'
    );

    expect(signature).toBe('d3585b01c4ebde6aeb29ca5f52ecfdfce5d55a4b');
  });
});

describe('buildUploadSignature', () => {
  it('forces the folder under the upload root and signs timestamp + folder', async () => {
    const { buildUploadSignature } = await loadCloudinary();

    const grant = buildUploadSignature(
      { folder: 'thumbnails', resourceType: 'image' },
      new Date(1728000000 * 1000)
    );

    expect(grant).toEqual({
      cloudName: 'demo-cloud',
      apiKey: 'test-key',
      timestamp: 1728000000,
      folder: 'megatech/media/thumbnails',
      signature: 'd3585b01c4ebde6aeb29ca5f52ecfdfce5d55a4b',
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
    });
  });

  it('defaults to the upload root when no sub-folder is given', async () => {
    const { buildUploadSignature } = await loadCloudinary();

    const grant = buildUploadSignature({ resourceType: 'video' });

    expect(grant.folder).toBe('megatech/media');
    expect(grant.uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo-cloud/video/upload');
  });

  it.each(['media', 'thumbnails', 'avatars', 'payments', 'documents'])('allows the %s sub-folder', async (folder) => {
    const { buildUploadSignature } = await loadCloudinary();

    expect(buildUploadSignature({ folder, resourceType: 'auto' }).folder).toBe(
      `megatech/media/${folder}`
    );
  });

  it('rejects folders outside the allow-list', async () => {
    const { buildUploadSignature } = await loadCloudinary();

    expect(() => buildUploadSignature({ folder: '../secrets', resourceType: 'image' })).toThrow(
      /Invalid upload folder/
    );
  });
});

describe('isOwnCloudinaryUrl', () => {
  it('accepts delivery URLs from our own cloud', async () => {
    const { isOwnCloudinaryUrl } = await loadCloudinary();

    expect(
      isOwnCloudinaryUrl('https://res.cloudinary.com/demo-cloud/image/upload/v1/megatech/a.jpg')
    ).toBe(true);
  });

  it('rejects other clouds, other hosts and garbage', async () => {
    const { isOwnCloudinaryUrl } = await loadCloudinary();

    expect(isOwnCloudinaryUrl('https://res.cloudinary.com/other/image/upload/a.jpg')).toBe(false);
    expect(isOwnCloudinaryUrl('https://example.com/demo-cloud/a.jpg')).toBe(false);
    expect(isOwnCloudinaryUrl('not a url')).toBe(false);
  });
});

describe('extractPublicId', () => {
  it('strips the version prefix and the file extension', async () => {
    const { extractPublicId } = await loadCloudinary();

    expect(
      extractPublicId('https://res.cloudinary.com/demo-cloud/video/upload/v1728000000/megatech/sermon.mp4')
    ).toBe('megatech/sermon');
  });

  it('returns null for foreign URLs', async () => {
    const { extractPublicId } = await loadCloudinary();

    expect(extractPublicId('https://www.youtube.com/watch?v=abc')).toBeNull();
  });
});
