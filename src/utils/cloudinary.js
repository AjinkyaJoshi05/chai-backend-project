import cloudinaryModule from "cloudinary";
const cloudinary = cloudinaryModule.v2;
import fs from "fs";

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
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

export {uploadOnCloudinary} ;