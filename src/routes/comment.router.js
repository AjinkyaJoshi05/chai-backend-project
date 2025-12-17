import { Router } from "express";
import {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
} from "../controllers/comment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/:videoId").get(getVideoComments);

//protected routes
router.route("/post").post(verifyJWT, addComment);
router.route("/c/update").post(verifyJWT, updateComment);
router.route("/c/delete").post(verifyJWT, deleteComment);

export default router;
