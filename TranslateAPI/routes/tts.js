var googleTTS = require('google-tts-api');
var express = require('express');
var md5 = require('md5');
var redis = require("redis");
var helper = require("../utils/texthelper");
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

router.post('/test', function (req, res) {
    res.json(helper.breakParagraph(req.body + ""));
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

            //Break text
            var breakTexts = helper.breakParagraph(request.text, 200);
            var urls = Array(breakTexts.length).fill("");
            var results = Array(breakTexts.length).fill(undefined);

            //Check is done tts
            function isDone() {
                for (var i = 0; i < results.length; i++) {
                    if (results[i] === undefined) return false;
                }

                return true;
            }

            //Check if had error
            function isError() {
                for (var i = 0; i < results.length; i++) {
                    if (results[i] === false) return i;
                }

                return -1;
            }

            //Response when tts error
            function error(index) {
                //Send response
                TextResponse(res, urls[index], false, false);
            }

            //Response when tts success
            function done() {
                //Set redis cache
                client.set(key, urls, 'EX', expire);
                //Send response
                TextResponse(res, urls, true, false);
            }

            //Callback when every tts complete
            function ttsDone() {
                if (isDone()) {
                    var errorIndex = isError();
                    if (errorIndex > 0) {
                        error(errorIndex);
                    } else {
                        done();
                    }
                }
            }

            //Do all tts pararell
            breakTexts.forEach(function (text, index) {
                googleTTS(text, request.from, request.speed)
                    .then(function (url) {

                        //Set url and result success
                        urls[index] = url;
                        results[index] = true;

                        //call tts callback
                        ttsDone();
                    })
                    .catch(function (err) {

                        //Set error and result fail
                        urls[index] = err;
                        results[index] = false;

                        //call tts callback
                        ttsDone();
                    });
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
