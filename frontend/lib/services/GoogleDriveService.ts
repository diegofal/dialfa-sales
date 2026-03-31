import { google } from 'googleapis';

const SHARED_DRIVE_ID = '0AH68e1MQ-p8HUk9PVA';
const FOLDER_ID = '15wp_-a7CsKTVNH5Nyh7CywSr5JnbtrZM';

interface DriveFile {
  fileName: string;
  buffer: Buffer;
}

function getAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  const credentials = JSON.parse(Buffer.from(key, 'base64').toString('utf-8'));

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
}

export async function listAndDownloadFiles(): Promise<DriveFile[]> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      driveId: SHARED_DRIVE_ID,
      corpora: 'drive',
      q: `'${FOLDER_ID}' in parents`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageToken,
    });

    const fileList = response.data.files || [];

    for (const file of fileList) {
      if (!file.id || !file.name) continue;

      const fileResponse = await drive.files.get(
        { fileId: file.id, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      );

      files.push({
        fileName: file.name,
        buffer: Buffer.from(fileResponse.data as ArrayBuffer),
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}
