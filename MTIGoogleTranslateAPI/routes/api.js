var translate = require('google-translate-api');
var express = require('express');
var md5 = require('md5');
var redis = require("redis");
var router = express.Router();
var client = redis.createClient("redis://pub-redis-19523.us-west-2-1.1.ec2.garantiadata.com:19523/0?password=9a0722309074e7b5c018733d801ea381");

//Check redis error
client.on("error", function (err) {
    console.log("Error " + err);
});

//Translate
router.post('/translate', function (req, res) {
    var translateTo = req.get("to-language");
    var translateFrom = req.get("from-language");
    var autoDetect = req.get("auto-detect-language");
    var text = req.body + "";

    //Check params to language
    if (translateTo === undefined) {

        res.end('header param "to-language" is missing.');
        return;
    }

    //Check params from language
    if (translateFrom === undefined) {

        res.end('header param "from-language" is missing.');
        return;
    }

    //Check body
    if (text === undefined || text.length <= 0) {
        res.end("");
        return;
    }
    var key = md5(text) + translateTo;
    client.get(key, function (err, reply) {
        if (err || reply == undefined) {
            //Translate setting
            var translateSetting = {};
            translateSetting.to = translateTo;
            translateSetting.from = autoDetect === "false" ? translateFrom : 'auto';

            //Do translate
            translate(text, translateSetting).then(result => {
                //Set redis cache
                client.set(key, JSON.stringify({ text: result.text, from: result.from.language.iso }), 'EX', 86400);

                res.set("from-language", result.from.language.iso);
                res.set("to-language", translateTo);
                res.set("translate-success", true);
                res.set("cache", false);
                res.end(result.text);
            }).catch(err => {
                res.set("translate-success", false);
                res.end(err);
            });
        } else {
            var translateResult = JSON.parse(reply);
            res.set("from-language", translateResult.from);
            res.set("to-language", translateTo);
            res.set("translate-success", true);
            res.set("cache", true);
            res.end(translateResult.text);
        }
    });
});


module.exports = router;
