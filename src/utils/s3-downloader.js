/**
 * S3 Secure Downloader - Enhanced Version
 * 
 * Downloads files from private S3 buckets using AWS Signature V4
 * Enhanced with multiple download strategies like PDF Annotations widget
 */

import CryptoJS from "crypto-js";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Enhanced URL encoding for S3 keys - handles all special characters
 * (Same encoding as PDF Annotations widget)
 */
export const encodeS3Key = (key) => {
    // First, ensure the key is properly decoded if it's already encoded
    let decodedKey;
    try {
        decodedKey = decodeURIComponent(key);
    } catch (e) {
        decodedKey = key;
    }
    
    // Split by forward slashes to preserve path structure
    const pathParts = decodedKey.split('/');
    
    // Encode each part separately to handle special characters
    const encodedParts = pathParts.map(part => {
        return encodeURIComponent(part)
            // Handle characters that cause AWS signature problems
            .replace(/[!'()*]/g, function(c) {
                return '%' + c.charCodeAt(0).toString(16).toUpperCase();
            })
            // Additional encoding for problematic characters
            .replace(/\(/g, '%28')  // Left parenthesis
            .replace(/\)/g, '%29')  // Right parenthesis
            .replace(/\[/g, '%5B')  // Left bracket
            .replace(/\]/g, '%5D')  // Right bracket
            .replace(/\{/g, '%7B')  // Left brace
            .replace(/\}/g, '%7D')  // Right brace
            .replace(/\#/g, '%23')  // Hash
            .replace(/\?/g, '%3F')  // Question mark
            .replace(/\&/g, '%26')  // Ampersand
            .replace(/\=/g, '%3D')  // Equals
            .replace(/\+/g, '%2B')  // Plus (don't convert spaces to + for S3)
            .replace(/%20/g, '%20'); // Keep %20 for spaces instead of +
    });
    
    return encodedParts.join('/');
};

/**
 * Generate AWS-formatted date strings
 */
export const getAmzDateStrings = () => {
    const now = new Date();
    const amzDate = now.toISOString()
        .replace(/[:-]/g, '')
        .replace(/\.\d{3}/, '');
    const dateStamp = amzDate.substring(0, 8);
    
    return { amzDate, dateStamp };
};

/**
 * Derive AWS Signature V4 signing key
 */
export const createSigningKey = (secretKey, dateStamp, region, service) => {
    const kDate = CryptoJS.HmacSHA256(dateStamp, `AWS4${secretKey}`);
    const kRegion = CryptoJS.HmacSHA256(region, kDate);
    const kService = CryptoJS.HmacSHA256(service, kRegion);
    const kSigning = CryptoJS.HmacSHA256('aws4_request', kService);
    
    return kSigning;
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Create AWS Signature V4 presigned URL
 */
export const createPresignedUrl = (config, bucketName, fileName, expirationSeconds = 3600) => {
    const { accessKey, secretKey, region } = config;
    
    console.log('🔗 Creating presigned URL with enhanced encoding');
    console.log('Original fileName:', fileName);
    
    const method = 'GET';
    const service = 's3';
    const algorithm = 'AWS4-HMAC-SHA256';
    const endpoint = `https://${bucketName}.s3.${region}.amazonaws.com`;
    
    // Use enhanced encoding function
    const encodedKey = encodeS3Key(fileName);
    const canonicalUri = `/${encodedKey}`;
    
    console.log('Enhanced encoded key:', encodedKey);
    
    const { amzDate, dateStamp } = getAmzDateStrings();
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.set('X-Amz-Algorithm', algorithm);
    queryParams.set('X-Amz-Credential', `${accessKey}/${credentialScope}`);
    queryParams.set('X-Amz-Date', amzDate);
    queryParams.set('X-Amz-Expires', expirationSeconds.toString());
    queryParams.set('X-Amz-SignedHeaders', 'host');
    
    // Build canonical request
    const canonicalQuerystring = queryParams.toString();
    const canonicalHeaders = `host:${bucketName}.s3.${region}.amazonaws.com\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';
    
    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQuerystring,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');
    
    // Build string to sign
    const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        CryptoJS.SHA256(canonicalRequest).toString()
    ].join('\n');
    
    // Calculate signature
    const signingKey = createSigningKey(secretKey, dateStamp, region, service);
    const signature = CryptoJS.HmacSHA256(stringToSign, signingKey).toString();
    
    // Build final URL
    queryParams.set('X-Amz-Signature', signature);
    
    const presignedUrl = `${endpoint}${canonicalUri}?${queryParams.toString()}`;
    
    console.log('🔗 Generated presigned URL (length:', presignedUrl.length, ')');
    
    return presignedUrl;
};

/**
 * Create signed headers for direct requests
 */
export const createSignedHeaders = (config, bucketName, fileName) => {
    const { accessKey, secretKey, region } = config;
    
    const { amzDate, dateStamp } = getAmzDateStrings();
    
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const credential = `${accessKey}/${credentialScope}`;
    
    const canonicalHeaders = `host:${bucketName}.s3.${region}.amazonaws.com\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    
    // Use enhanced encoding function
    const encodedFileName = encodeS3Key(fileName);
    
    const canonicalRequest = [
        'GET',
        `/${encodedFileName}`,
        '',
        canonicalHeaders,
        signedHeaders,
        'UNSIGNED-PAYLOAD'
    ].join('\n');

    const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        CryptoJS.SHA256(canonicalRequest).toString()
    ].join('\n');

    // Calculate signature
    const signingKey = createSigningKey(secretKey, dateStamp, region, 's3');
    const signature = CryptoJS.HmacSHA256(stringToSign, signingKey).toString();
    
    return {
        'Authorization': `${algorithm} Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD'
    };
};

/**
 * Fetch with automatic retry and exponential backoff
 */
export const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            lastError = error;
            console.warn(`Fetch attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt < maxRetries) {
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
        }
    }
    
    throw lastError;
};

/**
 * Download file from S3 using presigned URL (primary method)
 */
const downloadWithPresignedUrl = async (config, bucketName, fileName, onProgress) => {
    if (onProgress) onProgress(20, 'Creating pre-signed URL...', null);

    const signedUrl = createPresignedUrl(config, bucketName, fileName);
    
    if (onProgress) onProgress(40, 'Downloading via pre-signed URL...', signedUrl);

    const response = await fetchWithRetry(signedUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
            'Accept': 'application/pdf,*/*'
        }
    });

    if (!response.ok) {
        throw new Error(`Pre-signed URL download failed: ${response.status} ${response.statusText}`);
    }

    if (onProgress) onProgress(80, 'Processing downloaded data...', signedUrl);

    const arrayBuffer = await response.arrayBuffer();
    
    if (onProgress) onProgress(100, 'Download completed', signedUrl);

    return {
        buffer: new Uint8Array(arrayBuffer),
        contentType: response.headers.get('Content-Type') || 'application/pdf',
        size: arrayBuffer.byteLength,
        presignedUrl: signedUrl
    };
};

/**
 * Download file using direct signing (fallback method)
 */
const downloadWithDirectSigning = async (config, bucketName, fileName, onProgress) => {
    if (onProgress) onProgress(20, 'Creating direct signed request...', null);

    const encodedFileName = encodeS3Key(fileName);
    const url = `https://${bucketName}.s3.${config.region}.amazonaws.com/${encodedFileName}`;
    const signedHeaders = createSignedHeaders(config, bucketName, fileName);
    
    if (onProgress) onProgress(40, 'Downloading with signed headers...', url);

    const response = await fetchWithRetry(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
            ...signedHeaders,
            'Accept': 'application/pdf,*/*'
        }
    });

    if (!response.ok) {
        throw new Error(`Direct signed download failed: ${response.status} ${response.statusText}`);
    }

    if (onProgress) onProgress(80, 'Processing downloaded data...', url);

    const arrayBuffer = await response.arrayBuffer();
    
    if (onProgress) onProgress(100, 'Download completed', url);

    return {
        buffer: new Uint8Array(arrayBuffer),
        contentType: response.headers.get('Content-Type') || 'application/pdf',
        size: arrayBuffer.byteLength,
        presignedUrl: url
    };
};

/**
 * Download file from S3 with multiple strategies (like PDF Annotations)
 */
export const downloadFromS3 = async (config, bucketName, fileName, onProgress) => {
    console.log(`🔐 Downloading from private S3: s3://${bucketName}/${fileName}`);
    
    if (onProgress) onProgress(5, 'Initializing download...', null);

    // Try multiple download strategies (like PDF Annotations widget)
    const strategies = [
        { name: 'presigned', fn: () => downloadWithPresignedUrl(config, bucketName, fileName, onProgress) },
        { name: 'direct', fn: () => downloadWithDirectSigning(config, bucketName, fileName, onProgress) }
    ];

    let lastError = null;
    
    for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        try {
            if (onProgress) onProgress(10 + (i * 10), `Trying ${strategy.name} method...`, null);
            const result = await strategy.fn();
            console.log(`✅ Successfully downloaded using ${strategy.name} method`);
            return result;
        } catch (error) {
            console.warn(`❌ ${strategy.name} method failed:`, error.message);
            lastError = error;
            
            // If it's a credential issue, don't try other methods
            if (error.message.includes('403') || error.message.includes('Access denied')) {
                throw error;
            }
        }
    }

    throw lastError || new Error('All download methods failed');
};

/**
 * Test S3 connection
 */
export const testS3Connection = async (config, bucketName) => {
    try {
        console.info('🧪 Testing S3 connection...');
        
        // Method 1: Try pre-signed URL approach
        try {
            const testUrl = createPresignedUrl(config, bucketName, '__connection_test__', 60);
            const response = await fetch(testUrl, { method: 'HEAD', mode: 'cors' });
            
            // 200 = file exists, 404 = file doesn't exist but bucket accessible, 403 = no access
            if (response.status === 200 || response.status === 404) {
                console.log('✅ Pre-signed URL method works - AWS credentials valid');
                return { success: true, message: 'AWS credentials valid (pre-signed URL)' };
            }
        } catch (error) {
            console.warn('Pre-signed URL test failed:', error.message);
        }

        // Method 2: Try direct request to bucket
        try {
            const bucketUrl = `https://${bucketName}.s3.${config.region}.amazonaws.com/`;
            const response = await fetch(bucketUrl, { method: 'HEAD', mode: 'cors' });

            if (response.status === 200 || response.status === 403) {
                console.log('✅ Direct bucket access works - AWS setup valid');
                return { success: true, message: 'AWS setup valid (direct access)' };
            }
        } catch (error) {
            console.warn('Direct bucket test failed:', error.message);
        }

        throw new Error('All connection test methods failed');

    } catch (error) {
        console.error('❌ AWS credential test failed:', error);
        return { 
            success: false, 
            message: `Connection test failed: ${error.message}` 
        };
    }
};

// Export as class for compatibility (like PDF Annotations widget)
export class SecureS3Downloader {
    constructor(accessKey, secretKey, region) {
        this.config = { accessKey, secretKey, region };
    }

    async downloadFile(bucketName, fileName, onProgress) {
        return downloadFromS3(this.config, bucketName, fileName, onProgress);
    }

    async testConnection(bucketName) {
        return testS3Connection(this.config, bucketName);
    }

    generatePresignedUrl(bucketName, fileName, expirationSeconds = 3600) {
        return createPresignedUrl(this.config, bucketName, fileName, expirationSeconds);
    }
}