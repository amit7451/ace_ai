import { R2StorageProvider } from '@ion-ai/storage';
import { env } from '@ion-ai/config';

async function testR2() {
  console.log('Testing R2 with account:', env.R2_ACCOUNT_ID);

  const storageProvider = new R2StorageProvider({
    accountId: env.R2_ACCOUNT_ID ?? '',
    accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
    bucketName: env.R2_BUCKET_NAME ?? 'ion-ai-knowledge',
  });

  try {
    console.log('Uploading dummy file...');
    await storageProvider.upload('dummy-test-key.txt', Buffer.from('hello world'), 'text/plain');
    console.log('Upload successful!');
  } catch (err) {
    console.error('R2 Error:', err);
  }
}

testR2();
