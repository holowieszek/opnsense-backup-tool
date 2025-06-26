import moment from 'moment';
import axios from 'axios';
import https from 'https';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createWriteStream, createReadStream } from 'fs';

const { BACKUP_API_URL, OPNSENSE_API_KEY, OPNSENSE_SECRET_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME } = process.env;

if (!OPNSENSE_API_KEY || !OPNSENSE_SECRET_KEY) {
    throw new Error('Missing OPNSense credentials');
}

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !S3_BUCKET_NAME) {
    throw new Error('Missing AWS configuration');
}

if (!BACKUP_API_URL) {
    throw new Error('Missing OPNSense API configuration');
}

const s3 = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    }
})

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

function getCurrentTimestamp() {
    return moment().format('YYYY_MM_DD_HH_mm_ss');
}

async function downloadBackup() {
    const filename = [getCurrentTimestamp(), 'xml'].join('.');

    const config = {
        responseType: 'stream',
        auth: {
            username: OPNSENSE_API_KEY,
            password: OPNSENSE_SECRET_KEY
        },
        httpsAgent
    }

    const response = await axios.get(BACKUP_API_URL, config);
    
    const writer = createWriteStream(filename);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filename))
        writer.on('error', reject)
    });
}

async function uploadBackup (localFilePath, s3Key) {
    const stream = createReadStream(localFilePath);

    const upload = new Upload({
        client: s3,
        params: {
            Bucket: S3_BUCKET_NAME,
            Key: s3Key,
            Body: stream
        }
    });

    return upload.done();
}

(async () => {
    try {
        const backup = await downloadBackup();
        const upload = await uploadBackup(backup, backup);
        
        console.log('The backup file has been uploaded to the AWS S3 bucket successfully.');
    } catch (e) {
        if (e.response) {
            console.error('API response error', e.response.status, e.response.data)
        } else {
            console.error('Error', e); 
        }
    }
})();
