/**
 * firebase-uploader.js
 * Handles image compression and uploading to Firebase Storage.
 */

// Make compressImage available globally
window.compressImage = function(file, maxSize = 600, quality = 0.8) {
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
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// For scripts that might call compressImage without window.
if (typeof window !== 'undefined') {
    window.uploadToFirebase = async function(file, prefix = 'Image') {
        return new Promise((resolve, reject) => {
            if (!window.storage && typeof firebase !== 'undefined' && firebase.storage) {
                window.storage = firebase.storage();
            }
            if (!window.storage) {
                console.error("Firebase Storage is not initialized.");
                reject(new Error("Firebase Storage not initialized."));
                return;
            }

            const timestamp = new Date().getTime();
            // Create a safe filename
            const safePrefix = prefix.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${safePrefix}_${timestamp}.jpg`;
            const storageRef = window.storage.ref();
            const imageRef = storageRef.child(`uploads/${filename}`);

            const uploadTask = imageRef.put(file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    // Optional: handle progress
                }, 
                (error) => {
                    console.error("Upload to Firebase failed:", error);
                    reject(error);
                }, 
                () => {
                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                        resolve(downloadURL);
                    }).catch((err) => {
                        reject(err);
                    });
                }
            );
        });
    };
    
    // Also attach to window to be safe
    window.deleteFromFirebase = async function(fileUrl) {
        if (!fileUrl) return;
        // Don't try to delete placeholder or external URLs not in Firebase Storage
        if (!fileUrl.includes('firebasestorage.googleapis.com')) return;
        
        try {
            if (!window.storage && typeof firebase !== 'undefined' && firebase.storage) {
                window.storage = firebase.storage();
            }
            if (!window.storage) return;

            // Extract the path from the URL
            const httpsRef = window.storage.refFromURL(fileUrl);
            await httpsRef.delete();
            console.log("Old image deleted from Firebase Storage.");
        } catch (error) {
            console.error("Failed to delete image from Firebase Storage:", error);
        }
    };
}

// Allow scripts without window. prefix to access them if they share scope
const uploadToFirebase = window.uploadToFirebase;
const deleteFromFirebase = window.deleteFromFirebase;
