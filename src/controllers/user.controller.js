import {asyncHandler}  from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApipError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import path from "path";


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
export {registerUser, loginUser,logoutUser}