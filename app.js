if(process.env.NODE_ENV != "production"){
   require('dotenv').config();
}
const express=require("express");
const app=express();
const atlasUrl=process.env.ATLAS_URL;
const Listing =require("./models/listings");
const mongoose=require("mongoose");
const methodOverride=require("method-override");
const ejsMate=require("ejs-mate");
const port=8080;
const path=require("path");
const expressError=require("./error.js");
const ListingSchema=require("./joiSchema.js");
const Review=require("./models/Reviews.js");
const ReviewValidate=require("./joiSchema2.js");
const session=require("express-session");
const flash=require("connect-flash");
const passport=require("passport");
const localStrategy=require("passport-local");
const User=require("./models/User.js");
const upload=require("./cloudSetup.js");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken=process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });
const MongoStore=require("connect-mongo");





// Middlewares :
app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.static(path.join(__dirname,"/public")));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.engine("ejs",ejsMate);
//Validation Middlewares
const validateSchema=(req,res,next)=>{
   let result=ListingSchema.validate(req.body);
   console.log(result);
   if(result.error){
      throw new expressError(400,result.error);
   }else{
      next();
   }
};
const reviewValidate=(req,res,next)=>{
   let val=ReviewValidate.validate(req.body);
   if(val.error){
      throw new expressError(400,val.error);
   }else{
      next();
   }
};
const store= MongoStore.create({
   mongoUrl : atlasUrl,
   crypto:{
      secret:process.env.SECRET,
   },
   touchAfter: 24 * 3600,
});
store.on("error",() =>{
   console.log("Error In Mongo Session Store",err);
})
//Session Middlewares
app.use(session({store: store,secret:process.env.SECRET,resave:false,saveUninitialized:true,cookie:{
   expires:Date.now()+ 7 * 24 * 60 * 60 * 1000,
   maxAge:7 * 24 * 60 * 60 * 1000,
}}));
app.use(flash());
//Passport Middlewares:
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
const isLoggedIn=(req,res,next)=>{
   if(req.isAuthenticated()){
      next();
   }else{
      req.session.redirectUrl=req.originalUrl;
      req.flash("error","Login To Continue");
      return res.redirect("/login");
   }
};
app.use((req,res,next)=>{
   res.locals.successMsg=req.flash("success");
   res.locals.errorMsg=req.flash("error");
   res.locals.currUser=req.user;
   next();
})
const saveRedirectUrl=(req,res,next)=>{
   if(req.session.redirectUrl){
      res.locals.redirection=req.session.redirectUrl;
   }
      next();
   
};
const isOwner=async(req,res,next)=>{
   let {id}=req.params;
   const listing=await Listing.findById(id);
   if(listing.owner._id.equals(res.locals.currUser._id)){
      return next();
   }
    req.flash("error","Only Owners Can Perform Such Actions!!!");
    res.redirect(`/listings/${id}/show`);
}
const isReviewOwner=async(req,res,next)=>{
   let {id,reviewId}=req.params;
   const review=await Review.findById(reviewId);
   if(review.reviewOwner._id.equals(res.locals.currUser._id)){
      return next();
   }
    req.flash("error","Only Owners Can Perform Such Actions!!!");
    res.redirect(`/listings/${id}/show`);
}




// Initialize Database :
 async function main(){
    await  mongoose.connect(atlasUrl);
   } 
 main().then(()=>{
    console.log("connected to DB");
 }).catch((err)=>{
    console.log("Error while connecting to DB",err);
 })


// Server Side Code :

//listen
app.listen(port,()=>{
     console.log("App Is Listening on port",port);
})

//home route
app.get("/home",async(req,res,next)=>{
   try{
      let allListings= await Listing.find({});
      res.render("listings/home.ejs",{allListings});
   }catch(err){
      next(err);
   }
})

//Search Route
app.get("/search",async(req,res,next)=>{
   try{
      let {destination}=req.query;
      let searchedPlace= await Listing.findOne({title : destination});
      console.log("destination =",destination ,"Searched :",searchedPlace);
      if(!searchedPlace){
         next(400,"Destination You're Looking For Does Not Exists!");
      }
      res.render("listings/place.ejs",{searchedPlace});
   }catch(err){
      next(err);
   }
})


//show route
app.get("/listings/:id/show",async(req,res,next)=>{
   try{
      let {id}=req.params;
      const partList=await Listing.findById(id).populate({path:"reviews",populate:{path:"reviewOwner"},}).populate("owner");
      if(!partList){
         next(new expressError(400,"Listing You Requested For Does Not Exists!!!"));
      }
      res.render("listings/show.ejs",{partList});
   }catch(err){
      next(err);
   }
})

//new route
app.get("/listings/new",isLoggedIn,(req,res)=>{
   res.render("listings/new.ejs");
})
app.post("/listings/new",isLoggedIn,upload.single("Listings[image]"),validateSchema,async(req,res,next)=>{
   try{
       let response= await geocodingClient.forwardGeocode({
         query: req.body.Listings.location,
         limit: 2
       }) .send();
      
      let latitude=response.body.features[0].geometry.coordinates[0];
      let longitude=response.body.features[0].geometry.coordinates[1];
      console.log("lat:",latitude,"long :",longitude);
      const filename=req.file.filename;
      const url=req.file.path;
      const newList=new Listing(req.body.Listings);
      newList.coordinates={latitude,longitude};
      newList.image={filename,url};
      newList.owner=req.user._id;
       await newList.save();
       console.log(newList);
       req.flash("success","New Listing Created !!!");
       res.redirect("/home");
   }catch(err){
      next(err);
   }
})




//Edit Route :
app.get("/listings/:id/edit",isLoggedIn,isOwner,async(req,res,next)=>{
   try{
      let {id}=req.params;
      const listing=await Listing.findById(id);
      let originalImageUrl=listing.image.url;
      originalImageUrl.replace("/upload","/upload/w_250");
      if(!listing){
         next(new expressError(400,"Listing You Requested For Does Not Exists!!!"));
      }
      res.render("listings/edit.ejs",{listing,originalImageUrl});
   }catch(err){
      next(err);
   }
})

app.put("/listings/:id",isLoggedIn,isOwner,upload.single("Listings[image]"),validateSchema,async(req,res,next)=>{
   try{
      let {id}=req.params;
      let list=await Listing.findByIdAndUpdate(id, {...req.body.Listings});
      if(req.file){
         let url=req.file.path;
         let filename=req.file.filename;
         list.image={filename,url};
         await list.save();
      }
      req.flash("success","Listing Edited Successfully!!!");
      res.redirect("/home");
   }catch(err){
      next(err);
   }
})

// Delete Route :
app.delete("/listings/:id/delete",isLoggedIn,isOwner,async(req,res,next)=>{
   try{
      let {id}=req.params;
      const del=await Listing.findByIdAndDelete(id);
      if(!del){
         next(new expressError(400,"Can't delete"));
      }
      req.flash("success","Listing Deleted Successfully!!!");
      res.redirect("/home");
   }catch(err){
      next(err);
   }
})

// Reviews Route:
app.post("/listings/:id/review",isLoggedIn,reviewValidate,async(req,res,next)=>{
   try{
      let {id}=req.params;
      const list=await Listing.findById(id);
      const newReview=new Review(req.body.reviewVal);
      list.reviews.push(newReview);
      newReview.reviewOwner=req.user._id;
      await newReview.save();
      await list.save();
      req.flash("success","New Review Added!!!");
      console.log("new Review saved!");
      res.redirect(`/listings/${id}/show`);

   }catch(err){
      next(err);
   }
})
// Review Delete Route:
app.delete("/listings/:id/reviews/:reviewId", isLoggedIn,isReviewOwner,async(req,res,next)=>{
   try{
      let {id,reviewId}=req.params;
      await Listing.findByIdAndUpdate(id,{$pull:{reviews:reviewId}});
      await Review.findByIdAndDelete(reviewId);
      console.log("Review Deleted successfully!")
      req.flash("success","Review Deleted Successfully!!!");
      res.redirect(`/listings/${id}/show`);
   }catch(err){
      next(err);
   }
})

//User Signup Route:
app.get("/signUp",(req,res)=>{
   res.render("Users/signUp.ejs");
})
app.post("/signUp",async(req,res,next)=>{
   try{
      let {email,username,password}=req.body;
      const newUser=new User({
         email:email,
         username:username,
      });
      const registerUser=await User.register(newUser,password);
      req.login(registerUser,(err)=>{
         if(err){
            return next(err);
         }
         req.flash("success","Welcome To WanderLust!!!");
         console.log(registerUser);
         res.redirect("/home");
      })
   }catch(err){
      next(err);
   }
})

//User Login Route:

app.get("/login",(req,res)=>{
   res.render("Users/login.ejs");
})
app.post("/login",saveRedirectUrl,passport.authenticate("local",{failureRedirect:"/login",failureFlash:true}),async(req,res,next)=>{
   try{
      let userRedirection=res.locals.redirection || "/home";
      req.flash("success","Welcome Back To WanderLust");
      res.redirect(userRedirection);
   }catch(err){
   next(err);
   }
})

//User Logout Route:
app.get("/logout",async(req,res,next)=>{
   req.logout((err)=>{
      if(err){
         return next(err);
      }else{
         req.flash("error","Successfully Logged Out!");
         res.redirect("/home");
      }
   })
})

app.all("*",(req,res,next)=>{
   next(new expressError(400,"Page Not Found!"));
})
//Error Handling Middleware
app.use((err,req,res,next)=>{
   let {status=500,message="Some Random error"}=err;
   res.render("listings/error.ejs",{message});
})