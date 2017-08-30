var express = require('express');
var path = require('path');
var logger = require('morgan');
var concat = require('concat-stream');

var routes = require('./routes/index');
var api = require('./routes/api');
var tts = require('./routes/tts');
var translate = require('./routes/translate');

var app = express();

app.use(logger('dev'));
app.use(function (req, res, next) {
    req.pipe(concat(function (data) {
        req.body = data;
        next();
    }));
});

app.use('/', routes);
app.use('/api', api);
app.use('/tts', tts);
app.use('/translate', translate);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.end(err.message);
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.end(err);
});

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + server.address().port);
});
