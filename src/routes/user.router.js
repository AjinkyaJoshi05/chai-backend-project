import { Router } from "express";
import { loginUser, logoutUser, registerUser } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar", // this name has to be same in frontend
            maxCount:1 
        },
        {
            name: "coverImage",
            maxCount:1
        }
    ]),
    // this is the way to inject a moddleware.
    // call one just before the function.
    registerUser);

router.route("/login").post(loginUser);

// secured routes
router.route("/logout").post(verifyJWT, logoutUser)
export default router;