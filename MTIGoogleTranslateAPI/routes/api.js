var translate = require('google-translate-api');
var express = require('express');
var router = express.Router();

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

    //Translate setting
    var translateSetting = {};
    translateSetting.to = translateTo;
    translateSetting.from = autoDetect === "false" ? translateFrom : 'auto';

    //Do translate
    translate(text, translateSetting).then(result => {
        res.set("from-language", result.from.language.iso);
        res.set("to-language", translateTo);
        res.set("translate-success", true);
        res.end(result.text);
    }).catch(err => {
        res.set("translate-success", false);
        res.end(err);
    });
});


module.exports = router;
