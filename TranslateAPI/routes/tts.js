var googleTTS = require('google-tts-api');
var express = require('express');
var md5 = require('md5');
var redis = require("redis");
var router = express.Router();
var client = redis.createClient(process.env.REDIS_CONNECTION_STRING);
var expire = process.env.REDIS_EXPIRE;

//Check redis error
client.on("error", function (err) {
    console.log("Error " + err);
});

function TextResponse(res, url, success = false, cache = false) {
    res.json({
        success: success,
        cache: cache,
        url: url
    });
}

function TextsResponse(res, texts, success = false, cache = false) {
    res.json({
        success: success,
        cache: cache,
        words: words
    });
}

function breakSentence(text, maxLength = 200, endSentence = '.') {
    var breakTexts = [];
    var size = text.length;
    var index = 0;
    var offset = 0;

    while (index < size) {
        if (index - offset > maxLength || text[index] == '.') {
            breakTexts.push(text.substring(offset, index));
            offset = index+1;
        }

        index++;
    }

    if (size == index && index > offset + 1) {
        breakTexts.push(text.substring(offset, size));
    }

    return breakTexts;

    //var sentences = text.split(endSentence);
    //var breakTexts = [];

    //for (var i = 0; i < sentences.length;) {

    //    if (sentences[i].length > maxLength) {
    //        //Try break this sentence with comma
    //        var breakByCommas = breakSentence(sentences[i], maxLength, ',');

    //        if (breakByCommas.length > 1) {

    //        } else {
    //            breakTexts.concat(chunkString(sentences[i++], maxLength));
    //        }
    //    } else {
    //        var text = "";
    //        while (i < sentences.length && text.length + sentences[i].length < maxLength) {
    //            text += sentences[i++];
    //        }
    //        breakTexts.push(text);
    //    }
    //}

    return breakTexts;
}

function trimSentences(text) {
    var sentences = text.split('.');

    for (var i = 0; i < sentences.length; i++) {
        sentences[i] = sentences[i].trim();
    }

    return sentences.join('.');
}

router.post('/test', function (req, res) {
    res.json(breakSentence(trimSentences(req.body + "")));
});

//TTS sentence
router.post('/sentence', function (req, res) {
    var request = {};
    try {
        //Parse request body
        request = JSON.parse(req.body);
        //Trim text
        request.text = request.text.trim();
    } catch (e) { }

    //Check params from language
    if (request.from === undefined) {

        res.end('"from" param is missing.');
        return;
    }

    //Check params from language
    if (request.speed === undefined) {

        res.end('"speed" param is missing.');
        return;
    }

    //Check body
    if (request.text === undefined || request.text.length <= 0) {
        res.end("");
        return;
    }
    var key = "tts" + md5(request.text);
    client.get(key, function (err, reply) {
        if (err || reply == undefined) {

            //Do TTS
            googleTTS(request.text, request.from, request.speed)
                .then(function (url) {
                    //Set redis cache
                    client.set(key, [url], 'EX', expire);
                    //Send response
                    TextResponse(res, [url], true, false);
                })
                .catch(function (err) {

                    //Send response
                    TextResponse(res, err, false, false);
                });
        } else {

            //Send response
            TextResponse(res, reply, true, true);
        }
    });
});

//TTS word
router.post('/word', function (req, res) {
    var request = {};
    try {
        //Parse request body
        request = JSON.parse(req.body);
        //Trim text
        request.word = request.text.trim();
    } catch (e) { }

    //Check params from language
    if (request.from === undefined) {

        res.end('"from" param is missing.');
        return;
    }

    //Check params from language
    if (request.speed === undefined) {

        res.end('"speed" param is missing.');
        return;
    }

    //Check body
    if (request.word === undefined || request.word.length <= 0) {
        res.end("");
        return;
    }
    var key = "tts" + request.word;
    client.get(key, function (err, reply) {
        if (err || reply == undefined) {

            //Do TTS
            googleTTS(request.word, request.from, request.speed)
                .then(function (url) {
                    //Set redis cache
                    client.set(key, url, 'EX', expire);
                    //Send response
                    TextResponse(res, url, true, false);
                })
                .catch(function (err) {

                    //Send response
                    TextResponse(res, err, false, false);
                });
        } else {

            //Send response
            TextResponse(res, reply, true, true);
        }
    });
});

module.exports = router;
