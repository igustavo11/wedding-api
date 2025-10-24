import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export function uploadStream(buffer: Buffer, folder = 'gifts') {
  return new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error('No result from cloudinary'));
      resolve({ secure_url: result.secure_url });
    });

    stream.end(buffer);
  });
}
