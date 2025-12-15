import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApipError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "Unauthorized request");
    }

    // Aggregate all stats in parallel for better performance
    const [
        videoStats,
        subscriberCount,
        totalLikes,
        videoList
    ] = await Promise.all([
        // Get total videos and total views
        Video.aggregate([
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalViews: { $sum: "$views" }
                }
            }
        ]),

        // Get total subscribers
        Subscription.countDocuments({
            channel: userId
        }),

        // Get total likes on all videos
        Like.aggregate([
            {
                $lookup: {
                    from: "videos",
                    localField: "video",
                    foreignField: "_id",
                    as: "videoDetails"
                }
            },
            {
                $unwind: "$videoDetails"
            },
            {
                $match: {
                    "videoDetails.owner": new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $count: "totalLikes"
            }
        ]),

        // Get list of all videos for additional stats
        Video.find({ owner: userId }).select("_id")
    ]);

    // Extract data from aggregation results
    const totalVideos = videoStats[0]?.totalVideos || 0;
    const totalViews = videoStats[0]?.totalViews || 0;
    const totalSubscribers = subscriberCount || 0;
    const totalLikesCount = totalLikes[0]?.totalLikes || 0;

    // Get total comments on all videos (if you have a Comment model)
    // Uncomment if Comment model exists
    /*
    const totalComments = await Comment.countDocuments({
        video: { $in: videoList.map(v => v._id) }
    });
    */

    const channelStats = {
        totalVideos,
        totalViews,
        totalSubscribers,
        totalLikes: totalLikesCount,
        // totalComments: totalComments || 0, // Uncomment if Comment model exists
    };

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channelStats,
                "Channel stats fetched successfully"
            )
        );
});

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "Unauthorized request");
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "createdAt"; // createdAt, views, duration, title
    const sortType = req.query.sortType === "asc" ? 1 : -1; // asc or desc
    const skip = (page - 1) * limit;

    // Maximum limit to prevent abuse
    const maxLimit = 50;
    const finalLimit = Math.min(limit, maxLimit);

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortType;

    // Get total count for pagination
    const totalVideos = await Video.countDocuments({
        owner: userId
    });

    // Get videos with all details using aggregation
    const videos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
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
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments"
            }
        },
        {
            $addFields: {
                likesCount: { $size: "$likes" },
                commentsCount: { $size: "$comments" }
            }
        },
        {
            $project: {
                _id: 1,
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
                likesCount: 1,
                commentsCount: 1
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
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = {
        videos,
        pagination: {
            currentPage: page,
            totalPages,
            totalVideos,
            videosPerPage: finalLimit,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? page + 1 : null,
            prevPage: hasPrevPage ? page - 1 : null
        }
    };

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                response,
                "Channel videos fetched successfully"
            )
        );
});

export {
    getChannelStats, 
    getChannelVideos
}