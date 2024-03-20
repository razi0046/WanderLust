const  mongoose=require("mongoose");
const listings=require("../models/listings.js");
const sampleData=require("./data.js");

// Initialize Database :
async function main(){
    await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
 } 
 main().then(()=>{
    console.log("connected to DB");
 }).catch((err)=>{
    console.log("Error while connecting to DB",err);
 })

const initDB=async()=>{
    await listings.deleteMany({});
    sampleData.data=sampleData.data.map((obj)=>({
      ...obj,owner:"65faabac050e1d759f7dc422",
    }));
    await listings.insertMany(sampleData.data);
    console.log("Data Inserted successfully");
    console.log(sampleData.data);
}

initDB();