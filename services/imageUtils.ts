/**
 * Compress and resize an image before upload
 * @param file - The image file to compress
 * @param maxWidth - Maximum width (default 800px)
 * @param quality - JPEG quality 0-1 (default 0.7)
 * @returns Promise with compressed base64 string
 */
export const compressImage = (
    file: File,
    maxWidth: number = 800,
    quality: number = 0.7
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG with compression
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

/**
 * Upload image to Supabase Storage
 * @param supabase - Supabase client
 * @param base64 - Base64 image string
 * @param fileName - File name to save
 * @returns Promise with public URL
 */
export const uploadImageToSupabase = async (
    supabase: any,
    base64: string,
    fileName: string
): Promise<string> => {
    // Convert base64 to blob
    const base64Data = base64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    // Generate unique file name
    const uniqueName = `${Date.now()}_${fileName}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('photos')
        .upload(uniqueName, blob, {
            contentType: 'image/jpeg',
            upsert: false
        });

    if (error) {
        console.error('Upload error:', error);
        throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(data.path);

    return urlData.publicUrl;
};
