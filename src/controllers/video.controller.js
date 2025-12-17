import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApipError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary,deleteFromCloudinary} from "../utils/cloudinary.js"
import { Like } from "../models/like.model.js"
import { Comment } from "../models/comment.model.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const maxLimit = 50;
    const finalLimit = Math.min(limitNum, maxLimit);

        const matchConditions = {
        isPublished: true // Only show published videos
    };

    // Filter by userId if provided
    if (userId) {
        if (!mongoose.isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid user ID");
        }
        matchConditions.owner = new mongoose.Types.ObjectId(userId);
    }

    // Search query - search in title and description
    if (query) {
        matchConditions.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ];
    }

    // Build sort options
    const sortOptions = {};
    if (sortBy) {
        // sortType: asc or desc (default: desc)
        sortOptions[sortBy] = sortType === "asc" ? 1 : -1;
    } else {
        // Default sort by creation date (newest first)
        sortOptions.createdAt = -1;
    }

    // Get total count for pagination
    const totalVideos = await Video.countDocuments(matchConditions);

    // Aggregate pipeline to get videos with owner details and stats
    const videos = await Video.aggregate([
        {
            $match: matchConditions
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                owner: { $first: "$ownerDetails" },
                likesCount: { $size: "$likes" }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                owner: 1,
                likesCount: 1,
                createdAt: 1,
                updatedAt: 1
            }
        },
        {
            $sort: sortOptions
        },
        {
            $skip: skip
        },
        {
            $limit: finalLimit
        }
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalVideos / finalLimit);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const response = {
        videos,
        pagination: {
            currentPage: pageNum,
            totalPages,
            totalVideos,
            videosPerPage: finalLimit,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? pageNum + 1 : null,
            prevPage: hasPrevPage ? pageNum - 1 : null
        }
    };

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                response,
                "Videos fetched successfully"
            )
        );
});


const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video
    if (!title || !title.trim()) {
        throw new ApiError(400, "Title is required");
    }

    if (!description || !description.trim()) {
        throw new ApiError(400, "Description is required");
    }

    // const videoFileLocalPath = path.resolve(req.files?.videoFile?.[0]?.path);
    // const thumbnailLocalPath = path.resolve(req.files?.thumbnail?.[0]?.path);

    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    
    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    
    if (!videoFile) {
        throw new ApiError(500, "Failed to upload video file");
    }

    // Upload thumbnail to cloudinary
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    
    if (!thumbnail) {
        throw new ApiError(500, "Failed to upload thumbnail");
    }

    const video = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title: title.trim(),
        description: description.trim(),
        duration,
        owner: req.user._id,
        isPublished: true
    });

    // Fetch the created video with owner details
    const createdVideo = await Video.findById(video._id).populate(
        "owner",
        "username fullname avatar"
    );

    if (!createdVideo) {
        throw new ApiError(500, "Something went wrong while publishing the video");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(
            201,
            createdVideo,
            "Video published successfully"
        )
    );
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if (!videoId?.trim()){
        throw new ApiError(400, "Video Id required");
    }

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                owner: { $first: "$owner" },
                likesCount: { $size: "$likes" },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ]);

    if (!video || video.length === 0) {
        throw new ApiError(404, "Video not found");
    }

    // Increment view count
    await Video.findByIdAndUpdate(videoId, {
        $inc: { views: 1 }
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                video[0],
                "Video fetched successfully"
            )
        );
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description} = req.body;

    //TODO: update video details like title, description, thumbnail
    if (!videoId?.trim()){
        throw new ApiError(400, "Video Id required");
    }

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    if (!title && !description && !req.file) {
        throw new ApiError(400, "At least one field is required to update");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video");
    }

    // Prepare update fields
    const updateFields = {};

    // Update title if provided
    if (title && title.trim()) {
        updateFields.title = title.trim();
    }

    // Update description if provided
    if (description && description.trim()) {
        updateFields.description = description.trim();
    }

    // Update thumbnail if new file is uploaded
    if (req.file) {
        const thumbnailLocalPath = req.file.path;

        // Upload new thumbnail to cloudinary
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

        if (!thumbnail) {
            throw new ApiError(500, "Failed to upload thumbnail");
        }

        // Delete old thumbnail from cloudinary
        if (video.thumbnail) {
            await deleteFromCloudinary(video.thumbnail);
        }

        updateFields.thumbnail = thumbnail.url;
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: updateFields
        },
        { new: true }
    ).populate("owner", "username fullname avatar");

    if (!updatedVideo) {
        throw new ApiError(500, "Failed to update video");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedVideo,
                "Video updated successfully"
            )
        );
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if (!videoId?.trim()) {
        throw new ApiError(400, "Video ID is required");
    }

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Find the video
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if the user is the owner of the video
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    // Delete video file from cloudinary
    if (video.videoFile) {
        await deleteFromCloudinary(video.videoFile);
    }

    // Delete thumbnail from cloudinary
    if (video.thumbnail) {
        await deleteFromCloudinary(video.thumbnail);
    }

    // Delete associated likes
    await Like.deleteMany({ video: videoId });

    // Delete associated comments (if Comment model exists)
    await Comment.deleteMany({ video: videoId });

    // Delete the video from database
    await Video.findByIdAndDelete(videoId);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Video deleted successfully"
            )
        );
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!videoId?.trim()) {
        throw new ApiError(400, "Video ID is required");
    }

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Find the video
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if the user is the owner of the video
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this video");
    }

    video.isPublished = !video.isPublished;
    await video.save({ validateBeforeSave: false });

    const statusMessage = video.isPublished 
        ? "Video published successfully" 
        : "Video unpublished successfully";

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    _id: video._id,
                    title: video.title,
                    isPublished: video.isPublished
                },
                statusMessage
            )
        );
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}