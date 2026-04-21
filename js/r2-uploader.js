/**
 * r2-uploader.js
 * Common utility for uploading files to Cloudflare R2 via Worker
 */

async function loadAWSSDK() {
    if (window.AWS) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://sdk.amazonaws.com/js/aws-sdk-2.1643.0.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function uploadToCloudflare(file, customPrefix = null) {
    const config = window.R2_CONFIG;
    
    if (window.location.protocol === 'file:') {
        const msg = "កំពុងប្រើប្រាស់ mode file:// ។ ប្រព័ន្ធអាចនឹងប្លុកការ Upload ដោយសារ CORS ។ សូមប្រើប្រាស់ Live Server!";
        console.warn(`[R2 Uploader] ${msg}`);
    }

    try {
        await loadAWSSDK();
    } catch(e) {
        throw new Error("បរាជ័យក្នុងការទាញយក AWS SDK ។ សូមពិនិត្យមើលអ៊ីនធឺណិតរបស់អ្នក។");
    }

    const s3 = new AWS.S3({
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        region: 'auto',
        signatureVersion: 'v4',
        s3ForcePathStyle: true // Important for Cloudflare R2
    });

    const extension = file.type.split('/')[1] || 'jpg';
    
    // Determine base filename
    let baseName = `img_${Date.now()}`;
    if (customPrefix) {
        // Sanitize prefix to remove spaces and special URL-breaking characters
        baseName = customPrefix.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\u1780-\u17FF]/g, '');
    }
    
    // Add small random string to avoid aggressive CDN caching
    const filename = `${baseName}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
    const bucket = config.bucketName || 'itk';

    console.log(`[R2 Uploader] Direct S3 upload to bucket: ${bucket}, filename: ${filename}`);

    const params = {
        Bucket: bucket,
        Key: filename,
        Body: file,
        ContentType: file.type
    };

    const uploadStatusEl = document.getElementById('uploadStatus');
    if (uploadStatusEl) {
        uploadStatusEl.textContent = "កំពុងបញ្ជូនរូបភាពទៅកាន់ Cloudflare R2...";
        uploadStatusEl.className = "small mt-1 text-primary";
    }

    try {
        await new Promise((resolve, reject) => {
            s3.putObject(params, function(err, data) {
                if (err) reject(err);
                else resolve(data);
            });
        });
        
        console.log("[R2 Uploader] Upload successful.");
        const baseUrl = config.publicUrl || config.endpoint || "";
        
        // Remove trailing slash from baseUrl if exists
        const formattedBaseUrl = baseUrl.replace(/\/$/, "");
        const finalUrl = `${formattedBaseUrl}/${filename}`;
        
        return finalUrl;

    } catch (err) {
        console.error("[R2 Uploader] S3 Upload Error:", err);
        let userMessage = "ការបញ្ជូនរូបភាពបរាជ័យ: " + err.message;
        
        if (err.code === "NetworkingError" || err.message.includes("CORS")) {
            userMessage = "បញ្ហាប្រព័ន្ធ Network ឬ CORS។ សូមប្រាកដថាអ្នកបានកំណត់ CORS នៅក្នុង Cloudflare R2 Bucket របស់អ្នកឲ្យបានត្រឹមត្រូវ។ (AllowedOrigins: ['*'], AllowedMethods: ['PUT'])";
        }

        if (window.Swal) {
            window.Swal.fire({
                icon: 'error',
                title: 'Upload Failed',
                text: userMessage
            });
        }
        
        throw err;
    }
}

/**
 * Reusable Image Compression Helper
 * Returns a File that is resized and compressed
 */
async function compressImage(file, maxSize = 800, quality = 0.8) {
    if (!file.type.startsWith('image/')) return file; // Skip non-images
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Keep aspect ratio
                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    } else {
                        resolve(file); // Fallback to original
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Make them globally available
window.uploadToCloudflare = uploadToCloudflare;
window.compressImage = compressImage;


/**
 * Helper to delete an image directly from Cloudflare R2
 */
async function deleteFromCloudflare(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') return;

    const config = window.R2_CONFIG;
    
    // Extract filename from the URL string
    const urlParts = fileUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    if (!filename) return;

    try {
        await loadAWSSDK();
    } catch(e) {
        console.error("[R2 Uploader] Failed to load AWS SDK for deletion.", e);
        return;
    }

    const s3 = new AWS.S3({
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        region: 'auto',
        signatureVersion: 'v4',
        s3ForcePathStyle: true
    });

    const bucket = config.bucketName || 'itk';
    console.log(`[R2 Uploader] Deleting from S3 bucket: ${bucket}, filename: ${filename}`);

    const params = {
        Bucket: bucket,
        Key: filename
    };

    try {
        await new Promise((resolve, reject) => {
            s3.deleteObject(params, function(err, data) {
                if (err) reject(err);
                else resolve(data);
            });
        });
        console.log("[R2 Uploader] Delete successful.");
    } catch (err) {
        console.error("[R2 Uploader] S3 Delete Error:", err);
    }
}

window.deleteFromCloudflare = deleteFromCloudflare;
