import {asyncHandler}  from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApipError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import path from "path";

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


export {registerUser}