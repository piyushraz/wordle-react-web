// Get my username

// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
// https://www.stackhawk.com/blog/react-cors-guide-what-it-is-and-how-to-enable-it/
function api_getUsername(cb){
	let url="/api/username";
	fetch(url, {
		method: "GET", // *GET, POST, PUT, DELETE, etc.
		mode: "same-origin", // no-cors, *cors, same-origin
		cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
		credentials: "same-origin", // include, *same-origin, omit
		headers: {
			// "Content-Type": "application/json",
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		redirect: "follow", // manual, *follow, error
		referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
		// body: JSON.stringify(), // body data type must match "Content-Type" header
	})
	.then(response=>response.json())
	.then(data=>cb(data))
	.catch(error=>console.log(error));
}

function api_guess(username, guess, cb){
	let url="/api/username/"+username+"/guess/"+guess;
	fetch(url, {
        method: "POST",
        mode: "same-origin",
        cache: "no-cache",
        credentials: "same-origin",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
    })
    .then(response => response.json())
    .then(data => cb(data))
    .catch(error => console.log(error));
}

function api_newgame(username, cb){
    let url="/api/username/"+username+"/newgame";
    fetch(url, {
        method: "PUT",
        mode: "same-origin",
        cache: "no-cache",
        credentials: "same-origin",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
    })
    .then(response => response.json())
    .then(data => cb(data))
    .catch(error => console.log(error));
}

  function api_getUserStats(username, cb) {
    let url = "/api/username/"+username+"/stats";
    fetch(url, {
        method: "GET",
        mode: "same-origin",
        cache: "no-cache",
        credentials: "same-origin",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
    })
    .then(response => response.json())
    .then(data => cb(data))
    .catch(error => console.log(error));
}

export { api_getUsername, api_guess, api_newgame, api_getUserStats }; // Update the export statement to include api_getUserStats

