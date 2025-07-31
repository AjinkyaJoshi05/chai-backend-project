// require('dotenv').config({path: './env'});
// import mongoose from "mongoose";
// import { DB_NAME } from "./constants";
// import express from "express";

import dotenv from "dotenv";
dotenv.config({
    path: './env'
})


import connectDB from "./db/index.js";
connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, () =>{
        console.log(`Server is running on port : ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("Mongo DB connection failed !!! ",err);
})






















/*  method 1: 
const app = express();
(async ()=>{
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",()=>{
            console.log("ERROR: ",error);
            throw error;
        })
        app.listen(process.env.PORT,()=>{
            console.log(`App listening on port ${process.env.PORT}`);
        })
    }catch (error){
        console.error("ERROR: ",error);
        throw error
    }
})()

*/