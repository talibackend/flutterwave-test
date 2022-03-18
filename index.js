const express = require("express");
const app = express();
const bp = require("body-parser");
const fs = require("fs");
const port = process.env.PORT || 3030;

app.use(bp.json());

const checkDuplicate = (db, obj)=>{
    let keys = Object.keys(db);
    for(let i = 0; i < keys.length; i++){
        let current = db[`${keys[i]}`];
        if(
            current.currency == obj.currency &&
            current.locale == obj.locale &&
            current.entity == obj.entity &&
            current.entityProperty == obj.entityProperty &&
            current.type == obj.type
        ){
            return each;
        }
    }
    return false;
    
}

app.get('/', (req, res)=>{res.send("<h1>LannisterPay is running.</h1>")})

app.post('/fees', (req, res)=>{
    const body = req.body;
    if(body.FeeConfigurationSpec == undefined){
        return res.status(400).json({status : false, message : "Invalid request body, FeeConfigurationSpec is required"});
    }else{
        const spec = body.FeeConfigurationSpec;
        const specSeperated = spec.split("\n");

        const specsCleanObject = {};

        const allowedCurrency = ["NGN", "*"];
        const allowedLocale = ["LOCL", "INTL", "*"];
        const allowedEntity = ["CREDIT-CARD", "DEBIT-CARD", "BANK-ACCOUNT", "USSD", "WALLET-ID", "*"];
        const allowedType = ["FLAT", "PERC", "FLAT_PERC"];
        

        for(let i = 0; i < specSeperated.length; i++){
            each = specSeperated[i];
            let eachSplitted = each.split(" ");
            let eachId = eachSplitted[0];
            let eachCurrency = eachSplitted[1];
            let eachLocale = eachSplitted[2];
            let eachEntityBlock = eachSplitted[3].split("(");
            let eachEntity = eachEntityBlock[0];
            let eachEntityProperty = eachEntityBlock[1].replace(")", "");
            let eachType = eachSplitted[6];
            let eachValue = eachSplitted[7];

            if(eachId.length != 8){
                return res.status(400).json({status : false, message : `Invalid spec id : ${eachId}.`});
            }

            if(!allowedCurrency.includes(eachCurrency)){
                return res.status(400).json({status : false, message : `Invalid currency ${eachCurrency}, ${allowedCurrency} allowed.`});
            }

            if(!allowedLocale.includes(eachLocale)){
                return res.status(400).json({status : false, message : `Invalid locale ${eachLocale}, ${allowedLocale} allowed.`});
            }

            if(!allowedEntity.includes(eachEntity)){
                return res.status(400).json({status : false, message : `Invalid entity ${eachEntity}, ${allowedEntity} allowed.`});
            }

            if(!allowedType.includes(eachType)){
                return res.status(400).json({status : false, message : `Invalid type ${eachType}, ${allowedType} allowed.`});
            }

            if(eachType == "FLAT_PERC"){
                if(!eachValue.includes(":")){
                    return res.status(400).json({status : false, message : `Invalid value format for type ${eachType}`});
                }
            }
            if(eachType == "PERC" || eachType == "FLAT"){
                if(eachValue.includes(":")){
                    return res.status(400).json({status : false, message : `Invalid value format for type ${eachType}`});
                }
            }
            let newObject = {
                id : eachId,
                currency : eachCurrency,
                locale : eachLocale,
                entity : eachEntity,
                entityProperty : eachEntityProperty,
                type : eachType,
                value : eachValue
            };
            if(checkDuplicate(specsCleanObject, newObject) != false){
                return res.status(400).json({status : false, message : `Duplicate spec for ${eachId}`});
            }
            let key = `${eachCurrency}-${eachLocale}-${eachEntity}-${eachEntityProperty}`;
            specsCleanObject[`${key}`] = newObject;
        }
        const fileContent = JSON.stringify(specsCleanObject);
        fs.writeFile('db.json', fileContent, 'utf-8', (err)=>{
            if(err){
                return res.status(500).json({status : false, message : `Sorry an internal server error occured, please check your payload and try again`});
            }else{
                return res.status(200).json({status : "ok", message : "Specs have been successfully created"});
            }
        })
    }
})

app.post("/compute-transaction-fee", (req, res)=>{
    const body = req.body;
    const db = JSON.parse(fs.readFileSync('db.json', {encoding : "utf-8"}));
    const ID = body.ID;
    const amount = body.Amount;
    const currency = body.Currency;
    const currencyCountry = body.CurrencyCountry;
    const customer = body.Customer;
    if(typeof(customer) != "object"){
        return res.status(500).json({status : false, message : `Customer field has be to a valid javascript object.`});
    }
    const customerId = customer.ID;
    const customerEmail = customer.EmailAddress;
    const customerName = customer.FullName;
    const bearsFee = customer.BearsFee;
    const paymentEntity = body.PaymentEntity;
    if(typeof(paymentEntity) != "object"){
        return res.status(500).json({status : false, message : `PaymmentEntity has be to a valid javascript object.`});
    }
    const entityId = paymentEntity.ID;
    const entityIssuer = paymentEntity.Issuer;
    const entityBrand = paymentEntity.Brand;
    const entityNumber = paymentEntity.Number;
    const sixId = paymentEntity.SixID;
    let type = paymentEntity.Type;
    const country = paymentEntity.Country;
    
    if(currencyCountry == country){
        locale = "LOCL";
    }else{
        locale = "INTL";
    }

    let mostSpecificSpec = {};

    const currencyOrderedArray = [currency, "*"];
    const localeOrderedArray = [locale, "*"];
    const entityOrderedArray = [type, "*"];
    const entityPropertyOrderedArray = [entityId, entityBrand, entityIssuer, entityNumber, sixId, "*"];

    if(mostSpecificSpec.type == undefined){
        for(let i = 0; i < entityPropertyOrderedArray.length; i++){
            let eachEntityProperty = entityPropertyOrderedArray[i];
            if(mostSpecificSpec.type == undefined){
                for(let j = 0; j < currencyOrderedArray.length; j++){
                    let eachCurrency = currencyOrderedArray[j];
                    if(mostSpecificSpec.type == undefined){
                        for(let k = 0; k < localeOrderedArray.length; k++){
                            let eachLocale = localeOrderedArray[k];
                            if(mostSpecificSpec.type == undefined){
                                for(let l = 0; l < entityOrderedArray.length; l++){
                                    let eachEntity = entityOrderedArray[l];
                                    let key = `${eachCurrency}-${eachLocale}-${eachEntity}-${eachEntityProperty}`;
                                    if(db[`${key}`] != undefined){
                                        mostSpecificSpec = db[`${key}`];
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if(mostSpecificSpec.type == undefined){
        return res.status(404).json({status : false, message : "We don't have a fee specification for this type of transaction"});
    }else{
        let fee = 0;
        if(mostSpecificSpec.type == "PERC"){
            fee = (mostSpecificSpec.value / 100) * amount;
        }else{
            if(mostSpecificSpec.type == "FLAT"){
                fee = (mostSpecificSpec.value);
            }else{
                if(mostSpecificSpec.type == "FLAT_PERC"){
                    let splitted = mostSpecificSpec.value.split(":");
                    fee = parseFloat(splitted[0]) + ((parseFloat(splitted[1]) / 100) * amount);
                }
            }
        }
        fee = Math.round(fee);
        if(bearsFee == true){
            res.status(200).json({ AppliedFeeID : mostSpecificSpec.id, AppliedFeeValue : fee, ChargeAmount : fee + amount, SettlementAmount : amount });
        }else{
            res.status(200).json({ AppliedFeeID : mostSpecificSpec.id, AppliedFeeValue : fee, ChargeAmount : amount, SettlementAmount : amount - fee });
        }
    }

});

app.listen(port, "0.0.0.0", ()=>{console.log(`Server running on :${port}`)});
