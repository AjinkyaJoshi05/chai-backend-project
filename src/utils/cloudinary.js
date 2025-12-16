import cloudinaryModule from "cloudinary";
const cloudinary = cloudinaryModule.v2;
import fs from "fs";

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});


const uploadOnCloudinary = async (localFilePath) =>{
    try {
        if (!localFilePath){
            return null;
        }
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        console.log("file is uploaded on cloudinary ", response.url);
        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        console.error("Cloudinary upload failed:", error.message);
        try{
            fs.unlinkSync(localFilePath) // remove the locally saved temporary file if upload failed
        }
        catch (unlinkErr){
            console.error(" Failed to delete temp file:", unlinkErr.message);
        }
        
        return null;
    }
}

const deleteFromCloudinary = async (publicUrl) => {
    try {
        if (!publicUrl) return null;

        // Extract public_id from the Cloudinary URL
        // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/youtube-clone/sample.jpg
        // We need: youtube-clone/sample
        
        const urlParts = publicUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        
        if (uploadIndex === -1) {
            console.error("Invalid Cloudinary URL");
            return null;
        }

        // Get everything after 'upload/v1234567890/'
        const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
        
        // Remove file extension
        const publicId = publicIdWithExtension.split('.')[0];

        // Determine resource type (video or image)
        let resourceType = "image";
        if (publicUrl.includes('/video/')) {
            resourceType = "video";
        }

        // Delete from cloudinary
        const response = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });

        console.log("File deleted from Cloudinary:", response);
        return response;

    } catch (error) {
        console.error("Cloudinary deletion error:", error);
        return null;
    }
};

export {uploadOnCloudinary,deleteFromCloudinary} ;