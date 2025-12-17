import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema  = new Schema(
    {
        content:{
            type: String,
            required: true,
            trim:true
        },
        video:{
            type:Schema.Types.ObjectId,
            ref:"Video",
            required: true,
            index: true
        },
        owner:{
            type:Schema.Types.ObjectId,
            ref:"User",
            required: true
        }
    },
    {timestamps:true}
);

// index for queries
commentSchema.index({ video: 1, createdAt: -1 });

commentSchema.plugin(mongooseAggregatePaginate);

export const Comment = mongoose.Model("Comment",commentSchema);