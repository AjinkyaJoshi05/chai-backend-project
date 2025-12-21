import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.models.js"
import {ApiError} from "../utils/ApipError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Video} from "../models/video.model.js"
import { populate } from "dotenv"

const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body
     //TODO: create playlist

    if (!name?.trim()){
        throw new ApiError(400,"Name is requires");
    }
    if (!description?.trim()){
        throw new ApiError(400, "Description is required");
    }

    const playlist = await Playlist.create(
        {
            name:name.trim(),
            description:description.trim(),
            owner:req.user._id,
            videos:[] // initially empty
        }
    );
    const createdPlaylist = await Playlist.findById(playlist._id).populate(
        "owner",
        "username fullname avatar" 
    )

    if (!createPlaylist){
        throw new ApiError(500, "Failed to create Playlist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            createPlaylist,
            "Playlist created Successfully"
        )
    );   
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    //TODO: get user playlists
    if (!userId?.trim()){
        throw new ApiError(400,"User ID is required");
    }
    if (!mongoose.isValidObjectId(userId)){
        throw new ApiError(400, "User ID is invalid");
    }

     const playlists = await Playlist.aggregate([
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
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videoDetails"
            }
        },
        {
            $addFields: {
                owner: { $first: "$owner" },
                videosCount: { $size: "$videos" },
                // Get first video thumbnail as playlist thumbnail
                playlistThumbnail: {
                    $cond: {
                        if: { $gt: [{ $size: "$videoDetails" }, 0] },
                        then: { $first: "$videoDetails.thumbnail" },
                        else: null
                    }
                }
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                owner: 1,
                videosCount: 1,
                playlistThumbnail: 1,
                createdAt: 1,
                updatedAt: 1
            }
        },
        {
            $sort: { createdAt: -1 } // Newest playlists first
        }
    ]);

     return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                playlists,
                "User playlists fetched successfully"
            )
        );
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    //TODO: get playlist by id
    if (!playlistId?.trim()){
        throw new ApiError(400, "PLaylistID is required");
    }
    if (!mongoose.isValidObjectId(playlistId)){
        throw new ApiError(400,"Playlist Id is Inavlid");
    }
    const playlist =   await Playlist.aggregate([
        {
            $match:{
                _id : new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup:{
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username:1,
                            fullname:1,
                            avatar:1
                        }
                    }
                ]
            }
        },
        {
            $lookup:{
                from : "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline:[
                    {
                        $lookup:{
                            from :"users",
                            localField:"owner",
                            foreignField:"_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project: {
                                        username:1,
                                        fullname:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner: {$first: "$owner"}
                        }
                    },
                    {
                        $project:{
                            _id:1,
                            videoFile: 1,
                            thumbnail:1,
                            title:1,
                            description:1,
                            duration:1,
                            views:1,
                            owner:1,
                            createdAt:1
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                owner : {$first:"$owner"},
                videosCount: {$size: "$videos"},
                totalDuration: {$sum : "$videos.duration"},
                totalViews: {$sum:"$videos.views"}
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                owner: 1,
                videos: 1,
                videosCount: 1,
                totalDuration: 1,
                totalViews: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ]);

    if (!playlist || playlist.length===0){
        throw new ApiError(404, "Playlist not found");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            playlist[0],
            "PLaylist fetched successfully"
        )
    );
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if (!playlistId?.trim()){
        throw new ApiError(400,"PLaylist ID required");
    }
    if (!videoId?.trim()){
        throw new ApiError(400,"Video ID is required");
    }

    if (!mongoose.isValidObjectId(playlistId)){
        throw new ApiError(400,"Playlist ID is not valid");
    }
    if (!mongoose.isValidObjectId(videoId)){
        throw new ApiError(400,"Video ID is not valid");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist){
        throw new ApiError(404,"Playlist not found");
    }

    if (playlist.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "You are not authorized to update this playlist");
    }

    const video = await Video.findById(videoId);
    if (!video){
        throw new ApiError(404, "Video not found");
    }

    if (playlist.videos.includes(videoId)){
        throw new ApiError (400, "This video already exists");
    }

    playlist.videos.push(videoId);
    playlist.save();

    const updatedPlaylist = await Playlist.findById(playlistId)
    .populate("owner", "username fullname avatar")
    .populate({
        path: "videos",
        select: "title thumbnail duration views",
        populate: {
            path: "owner",
            select: "username fullname avatar"
        }
    });

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updatedPlaylist,
            "Video added to playlist successfully"
        )
    );
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist

    // Validate playlistId
    if (!playlistId?.trim()) {
        throw new ApiError(400, "Playlist ID is required");
    }

    if (!mongoose.isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    // Validate videoId
    if (!videoId?.trim()) {
        throw new ApiError(400, "Video ID is required");
    }

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Check if playlist exists
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Check if user is the owner of the playlist
    if (playlist.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this playlist");
    }

    // Check if video exists in the playlist
    if (!playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video does not exist in the playlist");
    }

    // Remove video from playlist
    playlist.videos = playlist.videos.filter(
        (vid) => vid.toString() !== videoId
    );
    await playlist.save();
    // Fetch updated playlist with video details
    const updatedPlaylist = await Playlist.findById(playlistId)
    .populate("owner", "username fullname avatar")
    .populate({
        path: "videos",
        select: "title thumbnail duration views",
        populate: {
            path: "owner",
            select: "username fullname avatar"
        }
    });

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updatedPlaylist,
            "Video removed from playlist successfully"
        )
    );
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
    if (!playlistId?.trim()){
        throw new ApiError(400,"Playlist ID is required");
    }
    if(!mongoose.isValidObjectId(playlistId)){
        throw new ApiError(400,"Playlist ID is invalid");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist){
        throw new ApiError(404, "Playlist not found");
    }

    if (playlist.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "You are not a authenticated to delete this playlist");
    }

    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);
    if (!deletedPlaylist){
        throw new ApiError(500, "Failed to delete playlist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Playlist deleted successfully"
        )
    );
});

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist
    if (!playlistId?.trim()){
        throw new ApiError(400,"Playlist ID is required");
    }
    if (!isValidObjectId(playlistId)){
        throw new ApiError(400,"Playlist ID is not valid");
    }

    if (!(name?.trim() || description?.trim())){
        throw new ApiError(400,"Name or description required");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist){
        throw new ApiError(404,"Playlist not found");
    }
    
    if (playlist.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403,"You are not authenticated to update this playlist");
    }

    const updateFields = {};
    if (name && name.trim()){
        updateFields.name = name.trim()
    }
    if (description && description.trim()){
        updateFields.description = description.trim()
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set : updateFields
        }
    )
    .populate("owner" , "username fullname avatar")
    .populate({
        path: "vidoes",
        select : "title thumbnail duration views",
        populate:{
            path : "owner",
            selsct: "username fullname avatar"
        }
    });

    if (!updatedPlaylist){
        throw new ApiError(500,"Unable to update the playlist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updatedPlaylist,
            "Playlist updated Successfully"
        )
    );
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}