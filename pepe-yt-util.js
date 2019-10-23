const fetch = require("node-fetch");
const fetchVideoInfo = require("youtube-info");

const correctUrls = new Set([
	"youtube.com",
	"youtu.be",
	"y2u.be"
]);
/**
 * Returns an object consisting of:
 * youtube id, 
 * title, 
 * channel name
 * 
 * @param {string} str
 * @returns {Object}
 */
exports.getYoutubeItem = async (str) => {
	str = await str.replace(/^(https?:\/\/)?(www\.)?/, '');
	const id = await getYoutubeId(str);
	if (id.error) {
		return id;
	}
	const json = await fetchVideoInfo(id);
	if (json.error) {
		return {
			error: json.error.message
		};
	}
	var res = {
		id: json.videoId,
		name: json.title,
		channel: json.owner
	};
	return res;
}

/**
 * Use 'name.replace(/[\\\/\:\*\?\<\>\|\"]/g, '').replace(/\s+/g, ' ').replace(/([^\s])-([^\s])/g, '$1 - $2')'
 * to replace illegal signs nicely
 * Returns an array
 */
exports.getYoutubePlaylist = async (playlistId) => {
	var videos = [];
	var response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${yt_api_key}`);
	var json = await response.json();
	for (var i = 0; i < json.items.length; i++) {
		if (json.items[i].snippet.title.toLowerCase() != "deleted video" && json.items[i].snippet.title.toLowerCase() != "private video") {
			await videos.push({
				id: json.items[i].snippet.resourceId.videoId,
				name: json.items[i].snippet.title
			});
		}
	}
	while (json.nextPageToken) {
		response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${yt_api_key}&pageToken=${json.nextPageToken}`);
		json = await response.json();
		for (var i = 0; i < json.items.length; i++) {
			if (json.items[i].snippet.title.toLowerCase() != "deleted video" && json.items[i].snippet.title.toLowerCase() != "private video") {
				await videos.push({
					id: json.items[i].snippet.resourceId.videoId,
					name: json.items[i].snippet.title
				});
			}
		}
	}
	return videos;
}

async function getYoutubeId(str) {
	try {
		if (checkID(str)) {
			return str;
		} else if (correctUrls.has(str.substr(0, str.indexOf('/') ? str.indexOf('/') : 0))) {
			return getIdFromUrl(str.substr(str.indexOf('/') + 1));
		} else {
			if (!/^[a-zA-Z0-9-_]{39}$/.test(yt_api_key)) {
				return {
					error: `You have to provide a correct YoutubeAPI key if you want to use my search commands\nCurrent YoutubeAPI: ${yt_api_key}`
				};
			}
			const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=${encodeURIComponent(str)}&key=${yt_api_key}`);
			const json = await response.json();
			if (json.error) {
				return {
					error: json.error.message
				};
			}
			return json.items[0].id.videoId;
		}
	} catch (err) {
		return {
			error: err
		};
	}
}

function getIdFromUrl(str) {
	const arr = /([a-zA-Z0-9-_]{11})/.exec(str);
	return arr ? arr[1] : null;
}

function checkID (id) {
	return /^[a-zA-Z0-9-_]{11}$/.test(id);
}


// OTHERS
exports.initApiKey = (key) => {
	yt_api_key = key;
};