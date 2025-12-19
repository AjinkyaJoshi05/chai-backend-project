import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApipError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"
import { Comment } from "../models/comment.model.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video
    if (!videoId?.trim()){
        throw new ApiError(400, "VideoId is required");
    }
    if (!mongoose.isValidObjectId(videoId)){
        throw new ApiError(400, "Not a valid id");
    }

    const video = await Video.findById(videoId);

    if (!video){
        throw new ApiError(404,"Video not found");
    }

    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: req.user._id
    });

    if (existingLike) {
        // Unlike: Remove the like
        await Like.findByIdAndDelete(existingLike._id);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isLiked: false },
                "Video unliked successfully"
            )
        );
    } else {
        await Like.create({
        video: videoId,
        likedBy: req.user._id
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isLiked: true },
                "Video liked successfully"
            )
        );
    }
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment
    if (!commentId?.trim()){
        throw new ApiError(400,"Comment Id not found");
    }
    if (!mongoose.isValidObjectId()){
        throw new ApiError(400,"Not a valid Object Id");
    }

    const comment = await Comment.findById(commentId);
    if (!comment){
        throw new ApiError(404,"Comment not found");
    }

    const existingLike = await Like.findOne(
        {
            comment:commentId,
            likedBy:req.user._id
        }
    );
    
    if (existingLike){
        await Like.findByIdAndDelete(existingLike._id);

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {isLiked:false},
                "Comment Unlike Successfully"
            )
        );
    } else {
        await Like.create(
            {
                comment:commentId,
                likedBy: req.user._id
            }
        );

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {isLiked:true},
                "Comment Liked Successfully"
            )
        );
    }

});

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    if (!tweetId?.trim()) {
        throw new ApiError(400, "Tweet ID is required");
    }

    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    // Check if tweet exists
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    // Check if user already liked the tweet
    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user._id
    });

    if (existingLike) {
        // Unlike: Remove the like
        await Like.findByIdAndDelete(existingLike._id);

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isLiked: false },
                "Tweet unliked successfully"
            )
        );
    } else {
        // Like: Add new like
        await Like.create({
            tweet: tweetId,
            likedBy: req.user._id
        });

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isLiked: true },
                "Tweet liked successfully"
            )
        );
    }
});

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const { page = 1, limit = 10 } = req.query;

    // Parse pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Maximum limit to prevent abuse
    const maxLimit = 50;
    const finalLimit = Math.min(limitNum, maxLimit);

    // Get total count
    const totalLikedVideos = await Like.countDocuments({
        likedBy: req.user._id,
        video: { $exists: true }
    });

    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user._id),
                video: { $exists: true, $ne: null }
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videoDetails",
                pipeline: [
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
                        $addFields: {
                            owner: { $first: "$owner" }
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$videoDetails"
        },
        {
            $sort: { createdAt: -1 } // Most recently liked first
        },
        {
            $skip: skip
        },
        {
            $limit: finalLimit
        },
        {
            $project: {
                _id: 0,
                video: "$videoDetails",
                likedAt: "$createdAt"
            }
        }
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalLikedVideos / finalLimit);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const response = {
        likedVideos,
        pagination: {
            currentPage: pageNum,
            totalPages,
            totalLikedVideos,
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
                "Liked videos fetched successfully"
            )
        );
});

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}