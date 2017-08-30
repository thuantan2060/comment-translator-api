require("./arrayhelper");

module.exports = new function () {
    function _chunk(str, len) {
        var _size = Math.ceil(str.length / len),
            _ret = new Array(_size),
            _offset
            ;

        for (var _i = 0; _i < _size; _i++) {
            _offset = _i * len;
            _ret[_i] = str.substring(_offset, _offset + len);
        }

        return _ret;
    };

    function _break(text, maxLength = 200, separators, separatorIndex = 0, excludeLength = 0) {
        var separator = separators[separatorIndex];
        var parts = text.split(separator);
        var nextExcludeLength = parts.length > 1 ? separator.trim().length : 0;
        var results = [];

        for (var i = 0; i < parts.length; i++) {

            //Trim and check length
            parts[i] = parts[i].trim();
            if (parts[i].length <= 0) continue;

            //Check part i length with max length
            if (parts[i].length > maxLength) {

                if (separatorIndex < separators.length) {
                    //Break by next separator
                    results.append(_break(parts[i], maxLength, separators, separatorIndex + 1, nextExcludeLength));
                } else {
                    //Break by chuck max length
                    results.append(_chunk(parts[i], maxLength));
                }
            } else {
                results.push(parts[i]);
            }

            //Add separator to sequences
            if (results.length > 0 && i < parts.length - 1) {
                results[results.length - 1] += separator;
            }

            //Exclude length
            if (results[results.length - 1].length > maxLength - excludeLength) {

                //Break again
                var parts = _break(results[results.length - 1], maxLength - excludeLength, separators, separatorIndex + 1, nextExcludeLength);

                //Add parts into result
                results.splice(results.length - 1, 1);
                results.append(parts);
            }
        }

        return results;
    };

    function _join(parts, maxLength) {
        var results = [];
        var index = 0;
        var text = "";

        while (index < parts.length) {

            //Check if text is add, length of result is fit or not
            if (text.length + parts[index].length <= maxLength) {
                text += parts[index];
                index++;
            } else {
                results.push(text);
                text = "";
            }
        }

        //Push final text
        if (text.length > 0) {
            results.push(text);
        }

        return results;
    };

    function _breakParagraph(text, maxLength = 200, separators = "?!.;, ") {

        var parts = _break(text, maxLength, separators, 0);
        var joinParts = _join(parts, maxLength);
        return joinParts;
    }

    this.chunk = _chunk;
    this.break = _break;
    this.join = _join;
    this.breakParagraph = _breakParagraph;
}();
