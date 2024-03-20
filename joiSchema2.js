const Joi=require("joi");
const ReviewValidate=Joi.object({
    reviewVal:Joi.object({
        comment:Joi.string().required(),
        rating:Joi.number().required().min(1).max(5),
    }).required(),
});

module.exports=ReviewValidate;