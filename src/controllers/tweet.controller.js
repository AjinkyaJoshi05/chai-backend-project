import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApipError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Like } from "../models/like.model.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const {content} = req.body;
    if (!content || !content.trim()){
        throw new ApiError(400,"Tweet content not found");
    }

    const tweet = await Tweet.create({
        content: content.trim(),
        owner: req.user._id
    });

    const createdTweet = await Tweet.findById(tweet._id).populate(
        "owner",
        "username fullname avatar" 
    );

    return res
    .status(201)
    .json(
        new ApiResponse(
            201,
            createTweet,
            "Tweet created Successfully"
        )
    );
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate userId
    if (!userId?.trim()) {
        throw new ApiError(400, "User ID is required");
    }

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    // Parse pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Maximum limit to prevent abuse
    const maxLimit = 50;
    const finalLimit = Math.min(limitNum, maxLimit);

    // Get total count for pagination
    const totalTweets = await Tweet.countDocuments({ owner: userId });

    // Aggregate pipeline to get tweets with likes count
    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
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
                foreignField: "tweet",
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
                content: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1,
                createdAt: 1,
                updatedAt: 1
            }
        },
        {
            $sort: { createdAt: -1 } // Newest tweets first
        },
        {
            $skip: skip
        },
        {
            $limit: finalLimit
        }
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalTweets / finalLimit);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const response = {
        tweets,
        pagination: {
            currentPage: pageNum,
            totalPages,
            totalTweets,
            tweetsPerPage: finalLimit,
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
                "User tweets fetched successfully"
            )
        );
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const {tweetId} = req.params;
    const {content} = req.body;

    if (!tweetId?.trim()){
        return new ApiError(400, "Tweet id is required found");
    }
    if (!mongoose.isValidObjectId(tweetId)){
        return new ApiError(400, "Tweet Id is not valid");
    }

    if (!content || !content.trim()){
        return new ApiError(400, "new content is required");
    }

    if (content.trim().length>500){
        return new ApiError(400, "Max length can be 500 characters only");
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet){
        throw new ApiError(404, "tweet not found");
    }

    if (tweet.owner.toString() !== req.user._id.toString()){
         throw new ApiError(403, "Not an authorized user");
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content : content.trim()
            }
        },
        {new :true}
    ).populate("owner","username fullname avatar");

    if (!updatedTweet){
        throw new ApiError(500, "Failed to update tweet")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updatedTweet,
            "Tweet updated Successfully"
        )
    );
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params;

    // Validate tweetId
    if (!tweetId?.trim()) {
        throw new ApiError(400, "Tweet ID is required");
    }

    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    // Find tweet
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    // Check if user is the owner of the tweet
    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this tweet");
    }

    // Delete associated likes
    await Like.deleteMany({ tweet: tweetId });

    // Delete tweet
    await Tweet.findByIdAndDelete(tweetId);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Tweet deleted successfully"
            )
        );
});

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}