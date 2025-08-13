import {asyncHandler}  from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApipError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import path from "path";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";


const accessAndRefreshToken = async (UserId)=>{
    try {   
        const user = await User.findById(UserId)
        const accessToken = user.generateAccessToken()
        const refreshToken=  user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};
    } catch (error) {
        throw new ApiError(500,"Token: Something went worng")
    }
}

const registerUser = asyncHandler( async (req, res)=>{
    // get users data from frontend

    // validation -not empty

    // check user alreqady exist (check users and email)

    // check for images and avatar

    // upload them to cloudinary,avatar

    // create a user object - create user entry in db

    // remove password and refresh token from response

    // check for user creation

    // return res

    const {fullName, email, username, password} = req.body;
    console.log("Email: ",email);

    // if (fullName === ""){
    //     throw new ApiError(400, "FullName is required!")
    // } check each using if else
    
        // or
    
    if (

        [fullName,email,username, password].some((field)=>
        field ?.trim() === "")
    ){
        throw new ApiError(400, "All Fields are required")
    }

    const existingUser = await User.findOne({
        $or: [{username},{email}]
    })
    if (existingUser){
        throw new ApiError(409,"User with given username or email exists");
    }

    const avatarLocalPath = path.resolve(req.files?.avatar[0]?.path); // names from routes
    // const coverImageLocalPath = path.resolve(req.files?.coverImage[0]?.path);

    // it is recommended all files should be checked like this
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    if (!avatarLocalPath){
        throw new ApiError (400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    console.log("MUlter files:",req.files);
    if (!avatar){
        throw new ApiError (400, "Avatar file is required");
    }

    const user = await User.create({
        fullname: fullName,
        avatar:avatar.url,
        coverImage: coverImage?.url,
        email,
        password,
        username: username.toLowerCase(),

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"  // write all the fields you donot want to select
    );

    if (!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse (200, createdUser, "User registered Successfully")
    )


})

const loginUser = asyncHandler(async (req,res)=>{
    // take data from req body.
    // extract username/email field 
    // check for user in db (if not, give error)
    // take password, compare with password in db (bcrypt)
    // is all correct , login successful-> access and refresh token
    // send cookies
    
    const {email, username, password} = req.body;
    if (!(username || email)){
        throw new ApiError(400,"enter username or email");
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if (!user) {
        throw new ApiError(404,"User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401,"invalid user Credentials");
    }

    const {accessToken,refreshToken} = await accessAndRefreshToken(user._id);
    const loggedInUser  = await User.findOne(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse (
            200,
            {
                user:loggedInUser, accessToken,refreshToken
            },
            "User logged in Succssfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new : true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User Logged Out"))
})


const refreshAceessToken = asyncHandler(async (req,res)=>{
    const incommingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken
    if (!incommingRefreshToken){
        throw new ApiError(401,"unauthorized request");
    }
  try {
      const decodedToken = jwt.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
      const user = await User.findById(decodedToken?._id)
  
      if (!user){
          throw new ApiError(401,"invalid user");
      }
  
      if (incommingRefreshToken !== user?.refreshToken){
          throw new ApiError(401, "refresh token is expired or used");
      }
  
      const options = {
          httpOnly: true,
          secure: true
      }
  
      const {accessToken,newRefreshToken} =  await accessAndRefreshToken(user._id)
  
      return res
      .status(200)
      .cookie("accessToken",accessToken,options)
      .cookie("refreshToken",newRefreshToken,options)
      .json (
          new ApiResponse(
              200,
              {
                  accessToken, refreshToken: newRefreshToken
              },
              "Access token refreshed"
          )
      )
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh Token") 
  }
})

const changeCurreentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user?._id);

    const isPasswordCorrect =  await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed succsessfully"));

})

const getCurrentUser = asyncHandler(async (req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse (200, req.user, "Current user fetched successfully"));
})

const updateAccountDetails = asyncHandler(async (req,res)=>{
    const {fullname,email} = req.body;
    if (!fullname ||  !email ){
        throw new ApiError(400,"all fields are required"); 
    }

    const user = await User.findByIdAndUpdate(req.user?._id,{
        $set: {
            fullname: fullname,
            email: email
        }
    },{new: true})

    return res
    .status(200)
    .json (new ApiResponse(200,user,"User details updated successfully"))
});

const updateUserAvatar = asyncHandler(async (req,res)=>{
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath){
        throw new ApiError (400, "Avatar file is missing");
    }


    // todo delete previous avatar image

    const avatar = await uploadOnCloudinary (avatarLocalPath);
    if (!avatar.url){
        throw new ApiError (500, "Error while uploading an cloudinary");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,{
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

     return res
    .status(200)
    .json( new ApiResponse(200,user,"Avatar updated successfully"))
})

const updateCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath){
        throw new ApiError(400,"Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage.url){
        throw new ApiError(500,"Error in uploading file to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,{
            $set:{
                coverImage:coverImage.url
            }
        },{new:true}.select("-password")
    )

    return res
    .status(200)
    .json( new ApiResponse(200,user,"Cover Image updated successfully"))
});

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params;
    if (!username?.trim()){
        throw new ApiError(400,"Username is missing");
    }

    const channel = await User.aggregate([
        {
            $match:{
                username : username?.toLowerCase() 
            }
        }, // at the end of this stage (first) we will have all documents with the given username (the current user)
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        }, // at the end of this stage we have an array which contains all the documents that have subscribed to this user
        // checks in the subscriptions model for current user as a channel. its count gives no. of subscribers
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        }, // at the end of this stage we have all channels to which this user has subscribed to
        // checks in the subscriptions model for current user as a subscriber. Its count gives no.of subscribed to
        {
            $addFields:{
                subscriberCount:{
                    $size: "$subscribers"
                },
                channelsSubscribedToCount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]}, // this line heps chek wether the user is subscribed to the channel
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscriberCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }// the project passes all these fields to of the required dataframe.
    ])
    console.log(channel);

    if (!channel?.length){
        throw new ApiError (404,"Channel does not exist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User channel faced successfully")
    )
})

const getWatchHistory = asyncHandler(async (req,res) =>{
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                foreignField:"_id",
                as: "watchHistory",
                pipeline:[ // pipeline to lookup for the owner of the video to be displayed on watch history
                    {
                        $lookup:{ 
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as:  "owner", // at the end of this, we have the docs of owners/users to be put in watch history
                            pipeline:[ // pipeline to project only required fields of owner of the video
                                {
                                    $project:{
                                        fullname: 1,
                                        username:1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }// this gives an object (the first value of the array form the pipeline).
                    // now in the frontend, it becomes easier to access all the data (treat like and object)
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "watch history added successfully"
        )
    )
})

export {
    registerUser, 
    loginUser,
    logoutUser,
    refreshAceessToken,
    changeCurreentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory
}