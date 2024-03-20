const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review=require("./Reviews");

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  image: {
    filename:String,
    url:String,
  },
  price: Number,
  location: String,
  country: String,
  reviews:[
    {
      type:Schema.Types.ObjectId,
      ref:"Review",
    }
  ],
  owner:{
      type:Schema.Types.ObjectId,
      ref:"User",
  },
  coordinates:{
    latitude:Number,
    longitude:Number,
  }
});

listingSchema.post("findOneAndDelete",async(listing)=>{
  if(listing.reviews.length>0){
    let result=await Review.deleteMany({_id:{$in:listing.reviews}});
    console.log("Middleware is running",result);
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;