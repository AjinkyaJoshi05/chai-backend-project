import mongoose, {Schema} from "mongoose";

const tweetScehema  = new Schema(
    {
        content:{
            type: String,
            required: true,
            required:true,
            maxlength: 500
        },
        owner:{
            type:Schema.Types.ObjectId,
            ref:"User",
            required:true,
            index: true
        }
    },
    {timestamps:true}
);

tweetScehema.index({owner:1,createdAt:-1});

export const Tweet = mongoose.model("Tweet",tweetScehema);