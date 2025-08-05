import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js";

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
export default router;