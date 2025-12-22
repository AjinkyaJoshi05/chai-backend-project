import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApipError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription
    if (!channelId?.trim()){
        throw new ApiError(400,"Channell ID is required");
    }
    if (!mongoose.isValidObjectId(channelId)){
        throw new ApiError(400,"Channel Id is not valid");
    }
    if (channelId === req.user._id.toString()){
        throw new ApiError(400,"You cannot subscribe to ypur own channel");
    }

    const channel = await User.findById(channelId);
    if (!channel){
        throw new ApiError(404,"Channel not found");
    }

    const exisitngSubscription = await Subscription.findOne({
        subscriber: req.user._id,
        channel: channelId
    });
    
    if (exisitngSubscription) {
        await Subscription.findByIdAndDelete(exisitngSubscription._id);
        
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {isSubscribed: false},
                "Unsubscribed Successfully"
            )
        );
    }
    else {
        const newSubscrption = await Subscription.create(
            {
                subscriber: req.user._id,
                channel:channelId
            }
        );

        if (!newSubscrption){
            throw new ApiError(500, "could not subscribe to this channel")
        }

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {isSubscribed:true},
                "Subscribed Successfully"
            )
        );
    }
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    const {page=1, limit=10} = req.query;

    if (!channelId?.trim()){
        throw new ApiError(400, "Channel ID is required");
    }
    if (!mongoose.isValidObjectId(channelId)){
        throw new ApiError(400,"Channel iD is not valid");
    }
    
    const channel = await User.findById(channelId);
    if (!channel){
        throw new ApiError(400,"channel not found");
    }
    // Parse pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Maximum limit to prevent abuse
    const maxLimit = 50;
    const finalLimit = Math.min(limitNum, maxLimit);

    const totalSubscribers = await Subscription.countDocuments({
        channel:channelId
    });

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribedToSubscriber"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: {
                                $size: "$subscribedToSubscriber"
                            },
                            // Check if current user is subscribed to this subscriber
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [
                                            req.user?._id,
                                            "$subscribedToSubscriber.subscriber"
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$subscriber"
        },
        {
            $sort: { createdAt: -1 } // Most recent subscribers first
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
                subscriber: 1,
                subscribedAt: "$createdAt"
            }
        }
    ]);

    const totalPages = Math.ceil(totalSubscribers / finalLimit);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const response = {
        subscribers,
        pagination: {
            currentPage: pageNum,
            totalPages,
            totalSubscribers,
            subscribersPerPage: finalLimit,
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
            "Subscribers fetched successfully"
        )
    );
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
     const { page = 1, limit = 10 } = req.query;

    if (!subscriberId?.trim()) {
        throw new ApiError(400, "Subscriber ID is required");
    }

    if (!mongoose.isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }

    const user = await User.findById(subscriberId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const maxLimit = 50;
    const finalLimit = Math.min(limitNum, maxLimit);

    const totalChannels = await Subscription.countDocuments({
        subscriber: subscriberId
    });

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $lookup: {
                            from: "videos",
                            localField: "_id",
                            foreignField: "owner",
                            as: "videos"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: {
                                $size: "$subscribers"
                            },
                            videosCount: {
                                $size: "$videos"
                            },
                            // Check if current user is subscribed to this channel
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1,
                            coverImage: 1,
                            subscribersCount: 1,
                            videosCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$channel"
        },
        {
            $sort: { createdAt: -1 } // Most recently subscribed first
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
                channel: 1,
                subscribedAt: "$createdAt"
            }
        }
    ]);

    const totalPages = Math.ceil(totalChannels / finalLimit);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const response = {
        subscribedChannels,
        pagination: {
            currentPage: pageNum,
            totalPages,
            totalChannels,
            channelsPerPage: finalLimit,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? pageNum + 1 : null,
            prevPage: hasPrevPage ? pageNum - 1 : null
        }
    };

    return res
    .status(200)
    .josn(
        new ApiResponse(
            200,
            response,
            "Subscribed channels fetched successfully"
        )
    );
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}