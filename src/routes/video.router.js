import { Router } from "express";
import {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
} from "../controllers/video.controller.js";
import {upload} from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/").get(getAllVideos);
router.route("/:videoId").get(getVideoById);

// secured routes
router.route("/publish").post(verifyJWT, 
    upload.fields([
        {name : "videoFile" , maxCount:1},
        { name: "thumbnail", maxCount: 1 }
    ]),
    publishAVideo
);
router.route("/:videoId/update").patch(
    verifyJWT,
    upload.single("thumbnail"),
    updateVideo
);

router.route("/:videoId/delete").delete(verifyJWT, deleteVideo);

router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);

export default router;
