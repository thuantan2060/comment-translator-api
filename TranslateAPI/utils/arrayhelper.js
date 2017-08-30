Array.prototype.append = function (arr) {
	for (var i = 0; i < arr.length; i++) {
		this.push(arr[i]);
	}
}