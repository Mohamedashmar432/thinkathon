import crypto from 'crypto';

export function generateApiKey(email: string): string {
  const secret = process.env.SECRET_SALT || 'default-secret';
  const timestamp = Date.now().toString();
  const data = `${email}-${secret}-${timestamp}`;
  
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

