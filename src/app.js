import express from "express"
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({limit: "16kb"}));

app.use(express.urlencoded({extended:true,limit: "16kb"}));

app.use(express.static("public"));

app.use(cookieParser());



// router import
import UserRouter from "./routes/user.router.js";
import DashboardRouter from "./routes/dashboard.router.js";
import videoRouter from "./routes/video.router.js";
import commentRouter from "./routes/comment.router.js";
import tweetRouter from "./routes/tweet.router.js";
import likeRouter from "./routes/like.router.js";



// routes declaration
app.use("/api/v1/users",UserRouter);
app.use("/api/v1/dashboard",DashboardRouter);
app.use("/api/v1/video",videoRouter);
app.use("/api/v1/comment",commentRouter);
app.use("/api/v1/tweet",tweetRouter);
app.use("/ap1/v1/like",likeRouter);
 
// http://localhost:8000/api/v1/users/register


export { app }