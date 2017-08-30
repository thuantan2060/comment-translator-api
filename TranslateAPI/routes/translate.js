var translate = require('google-translate-api');
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

function SentenceResponse(res, from, to, text, success = false, cache = false) {
    res.json({
        from: from,
        to: to,
        success: success,
        cache: cache,
        text: text
    });
}

function WordResponse(res, from, to, words, success = false, cache = false) {
    res.json({
        from: from,
        to: to,
        success: success,
        cache: cache,
        words: words
    });
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
    var key = "tl" + md5(request.text) + request.to;
    client.get(key, function (err, reply) {
        if (err || reply == undefined) {

            //Do translate
            translate(request.text, { to: request.to, from: request.from }).then(result => {

                //Set redis cache
                client.set(key, JSON.stringify({ text: result.text, from: result.from.language.iso }), 'EX', expire);
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
    if (request.word === undefined || request.word.length <= 0) {
        res.end("");
        return;
    }
    var key = "tl" + request.word + request.to;
    client.get(key, function (err, reply) {
        if (err || reply == undefined) {

            //Do translate
            translate(request.word, { to: request.to, from: request.from }).then(result => {

                //Set redis cache
                client.set(key, JSON.stringify({ words: [result.text], from: result.from.language.iso }), 'EX', expire);

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

module.exports = router;
