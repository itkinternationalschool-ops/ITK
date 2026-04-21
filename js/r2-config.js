/**
 * Cloudflare R2 Configuration
 * Contains credentials for the school's image storage
 * Note: For production, it is highly recommended to use a Cloudflare Worker 
 * to handle uploads securely without exposing these keys to the client.
 */

const R2_CONFIG = {
    endpoint: "https://de112fdcf86cca83a566898b7ee4f55d.r2.cloudflarestorage.com",
    bucketName: "itk",
    accessKeyId: "YOUR_ACCESS_KEY_ID",
    secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
    apiToken: "YOUR_API_TOKEN",
    publicUrl: "https://pub-a159117494784ef69dff2fbe709edb13.r2.dev"
};

// Export to window for global access
window.R2_CONFIG = R2_CONFIG;
