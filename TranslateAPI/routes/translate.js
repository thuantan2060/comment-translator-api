var translate = require('google-translate-api');
var express = require('express');
var md5 = require('md5');
var redis = require("redis");
var router = express.Router();
var client = redis.createClient(process.env.REDIS_CONNECTION_STRING);
var expire = process.env.REDIS_EXPIRE;
var limitTokenResuseTime = 20;
var currentTokenUseTime = 0;

//Check redis error
client.on("error", function (err) {
    console.log("Error " + err);
});

function SentenceResponse(res, from, to, text, success = false, cache = false) {
    res.json({
        from: from,
        to: to,
        success: success,
        cache: cache,
        text: success ? text : undefined,
        error: success ? undefined : text,
    });
}

function WordResponse(res, from, to, words, success = false, cache = false) {
    res.json({
        from: from,
        to: to,
        success: success,
        cache: cache,
        words: success ? words : [],
        error: success ? undefined : words
    });
}

function WordsResponse(res, to, words, success = false, cache = false) {
    res.json({
        to: to,
        success: success,
        cache: cache,
        words: success ? words : [],
        error: success ? undefined : words
    });
}

function ClearToken() {
    //Increate token use
    currentTokenUseTime++;

    //Reset token
    if (currentTokenUseTime > limitTokenResuseTime) {
        translate.clearToken();
        currentTokenUseTime = 0;
    }
}

//Translate sentence
router.post('/sentence', function (req, res) {
    var request = {};
    try {
        //Parse request body
        request = JSON.parse(req.body);
        //Trim text
        request.text = request.text.trim();
    } catch (e) { }

    //Check params to language
    if (request.to === undefined) {

        res.end('"to" param is missing.');
        return;
    }

    //Check params from language
    if (request.from === undefined) {

        res.end('"from" param is missing.');
        return;
    }

    //Check body
    if (request.text === undefined || request.text.length <= 0) {
        res.end("");
        return;
    }
    var key = "tlst" + md5(request.text) + request.to;
    client.get(key, function (err, reply) {
        if (err || reply == undefined) {

            //Do translate
            translate(request.text, { to: request.to, from: request.from }).then(result => {

                //Set redis cache
                client.set(key, JSON.stringify({ text: result.text, from: result.from.language.iso }), 'EX', expire);

                //Clear token if it get to limit
                ClearToken();

                //Send response
                SentenceResponse(res, result.from.language.iso, request.to, result.text, true, false);
            }).catch(err => {

                //Send response
                SentenceResponse(res, request.from, request.to, err, false, false);
            });
        } else {

            //Parse redis cache
            var translateResult = JSON.parse(reply);

            //Send response
            SentenceResponse(res, translateResult.from, request.to, translateResult.text, true, true);
        }
    });
});

//Translate word
router.post('/word', function (req, res) {
    var request = {};
    try {
        //Parse request body
        request = JSON.parse(req.body);
        //Trim text
        request.word = request.word.trim();
    } catch (e) { }

    //Check params to language
    if (request.to === undefined) {

        res.end('"to" param is missing.');
        return;
    }

    //Check params from language
    if (request.from === undefined) {

        res.end('"from" param is missing.');
        return;
    }

    //Check body
    if (request.word === undefined || request.word.length <= 0) {
        res.end("");
        return;
    }
    var key = "tlwd" + request.word + request.to;
    client.get(key, function (err, reply) {
        if (err || reply == undefined) {

            //Do translate
            translate(request.word, { to: request.to, from: request.from }).then(result => {

                //Set redis cache
                client.set(key, JSON.stringify({ words: [result.text], from: result.from.language.iso }), 'EX', expire);

                //Clear token if it get to limit
                ClearToken();

                //Send response
                WordResponse(res, result.from.language.iso, request.to, [result.text], true, false);
            }).catch(err => {

                //Send response
                WordResponse(res, request.from, request.to, err, false);
            });
        } else {

            //Parse redis cache
            var translateResult = JSON.parse(reply);

            //Send response
            WordResponse(res, translateResult.from, request.to, translateResult.words, true, true);
        }
    });
});

//Translate words
router.post('/words', function (req, res) {
    var request = {};
    try {
        //Parse request body
        request = JSON.parse(req.body);

        //Trim all word
        for (var i = request.words.length - 1; i >= 0; i--) {
            request.words[i] = request.words[i].trim();
        }
    } catch (e) { }

    //Check params to language
    if (request.to === undefined) {

        res.end('"to" param is missing.');
        return;
    }

    //Check params from language
    if (request.from === undefined) {

        res.end('"from" param is missing.');
        return;
    }

    //Check body
    if (request.words === undefined || request.words.length <= 0) {
        res.end("No words found");
        return;
    }
    var key = "tlmw" + md5(request.words.join("")) + request.to;
    client.get(key, function (err, reply) {
        if (err || reply == undefined) {

            //Init result array
            var words = Array(request.words.length).fill({});
            var errors = Array(request.words.length).fill("");
            var results = Array(request.words.length).fill(undefined);

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
                WordsResponse(res, request.to, errors[index], false, false);
            }

            //Response when tts success
            function done() {
                //Set redis cache
                client.set(key, JSON.stringify(words), 'EX', expire);

                //Send response
                WordsResponse(res, request.to, words, true, false);
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

            //Clear token if it get to limit
            ClearToken();

            //Do all tts pararell
            request.words.forEach(function (word, index) {
                //Do translate
                translate(word, { to: request.to, from: request.from })
                    .then(function (result) {

                        //Set url and result success
                        words[index] = { language: result.from.language.iso, origin: word, translated: [result.text] };
                        results[index] = true;

                        //call tts callback
                        ttsDone();
                    }).catch(function (err) {

                        //Set error and result fail
                        errors[index] = JSON.stringify(err);
                        results[index] = false;

                        //call tts callback
                        ttsDone();
                    });
            });
        } else {

            //Parse redis cache
            var cacheWords = JSON.parse(reply);

            //Send response
            WordsResponse(res, request.to, cacheWords, true, true);
        }
    });
});

module.exports = router;
