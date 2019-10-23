const fs = require("fs");
const ytdl = require("ytdl-core");
const pepe = require("./pepe-yt-util.js");
const colors = require("colors");
const readline = require("readline");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
const config = JSON.parse(fs.readFileSync("./settings.json", "utf-8"));
const yt_api_key = config.yt_api_key;
const path = config.path;
var playlistData =  JSON.parse(fs.readFileSync("./playlist-data.json", "utf-8"));
var queue = [];

console.clear();
console.log("It's a me: ".bold + "PePe, The Music Boi".green)
rl.pause();
pepe.initApiKey(yt_api_key);
if (!playlistData) {
	playlistData = {};
	savePlaylistData();
}
validatePath();
async function validatePath() {
	var win = await fs.existsSync(path);
	if (!win) {
		console.log(`You have to provide a path to an existing folder, current path: '${path}'`.red.bold)
		process.exit();
	}
	if (!/^[a-zA-Z]:[\\\/]([^\\\/\:\*\?\<\>\|\"]+[\\\/])*$/.test(path)) {
		console.log(`You have to insert correct path if you want to use my download commands\nCurrent path: ${path}`.red.bold)
		process.exit();
	}
	showHelp();
	rl.prompt();
}
rl.on('line', async (line) => {
	try {
		// rl.pause();
		const args = line.trim().split(/\s+/);
		const str = args.slice(1).join(' ');
		switch (args[0]) {
			case "help":
				showHelp();
				break;
			case "list":
				for (var playlist in playlistData) {
					console.log(`${playlist}`.bold)
				}
				break;
			case "download":
				const item = await pepe.getYoutubeItem(str);
				if (item.error) {
					rl.clearLine();
					console.log(`${item.error}`.red)
					return;
				}
				item.name = convertToCorrectFileName(item.name);
				if (await checkIfFileExists(item, "random")) {
					console.log(`You already have '${item.name}' in your 'random' collection`.red)
					break;
				}
				const res = await download(item, "random");
				if (res.error) {
					console.log(`${res.error}`.red)
				} else {
					console.log(`Successfully downloaded: '${res.name}'`.green.bold)
				}
				break;
			case "init":
				if (!args[1]) {
					console.log("You have to provide all arguments: 'init directory-name youtube-playlist-link'".red)
					break;
				}
				if (/[\\\/\:\*\?\<\>\|\"]/.test(args[1])) {
					console.log(`You can't use: '\\', '\/', '\:', '\*', '\?', '\<', '\>', '\?', '\|', '\"' in a directory name: ${args[1]}`.red)
					break;
				}
				if (!args[2]) {
					console.log("You have to provide all arguments: 'init directory-name youtube-playlist-link'".red)
					break;
				}
				if (!/^https?:\/\/www\.youtube\.com\/playlist\?list\=[a-zA-Z0-9-_]{34}.*$/.test(args[2])) {
					rl.clearLine();
					console.log(`'${args[2]}' doesn't seem to be a playlist link`.red)
					break;
				}
				const arr = /[a-zA-Z0-9-_]{34}/.exec(args[2]);
				const id = arr ? arr[0] : null;
				if (id === null) {
					console.log(`'${args[2]}' doesn't seem to be a playlist link`.red)
					break;
				}
				if (await fs.existsSync(path + args[1]) || playlistData[args[1]]) {
					console.log(`'${args[1]}' directory already exists`.red)
					rl.question(`'${args[1]}' already exists, do you want to overwrite it? [Yes/No]\n` + "It will delete all previously downloaded songs in the old directory\n".red.bold, async (answer) => {
						if (answer == "Yes") {
							playlistData[args[1]] = {
								id: id
							};
							await deleteDirectory(args[1]);
							await fs.mkdirSync(path + args[1]);
							console.log(`'${args[1]}' was assigned to a new playlist`.yellow)
							rl.prompt();
							return;
						}
					});
					break;
				}
				playlistData[args[1]] = {
					id: id
				};
				await fs.mkdirSync(path + args[1]);
				savePlaylistData();
				console.log(`Successfully initiated '${args[1]}' directory`)
				break;
			case "remove":
				if (!args[1]) {
					console.log("You have to provide an argument: init directory-name".red)
					break;
				}
				if (!await fs.existsSync(path + args[1])) {
					console.log(`There is no such directory as: '${args[1]}'`.red)
					break;
				}
				await rl.question(`Are you sure you want to delete '${args[1]}'? [Yes/No]\n` + "It will delete all previously downloaded songs in this directory\n".red.bold, async (answer) => {
					if (answer == "Yes") {
						playlistData[args[1]] = {
							id: args[2]
						};
						await deleteDirectory(args[1]);
						delete playlistData[args[1]];
						savePlaylistData();
					}
					return;
				});
				console.log(`Deleted ${args[1]} directory`.green.bold)
				break;
			case "update":
				if (!args[1]) {
					console.log("You have to provide a playlist".red)
					break;
				}
				if (args[1] == "$all") {
					for (var playlist in playlistData) {
						console.log(`${playlist}:`.bold)
						await updatePlaylist(playlist);
					}
				} else {
					if (!playlistData[args[1]]) {
						console.log(`There is no such directory as: ${args[1]}\nYou have to initiate it firstly`.red)
						break;
					}
					await updatePlaylist(args[1]);
				}
				break;
			case "test":
				await fs.mkdirSync(path + args[1])
				break;
			default:
				console.log(`There is no such command as: '${args[0]}'`.red)
				break;
		}
		rl.prompt();
	} catch (err) {
		console.error(err)
	}
});

async function updatePlaylist(playlist) {
	try {
		if (!await fs.existsSync(path + playlist)) {
			await fs.mkdirSync(path + playlist);
		}
		const result = await pepe.getYoutubePlaylist(playlistData[playlist].id);
		if (result.error) {
			console.log(`An error has occurred:\n${result.error.message}`.red)
			return;
		}
		queue = await pepe.getYoutubePlaylist(playlistData[playlist].id);
		const res1 = await saveWholeQueue(playlist);
		if (res1.success.length != 0) {
			console.log(`Successfully downloaded ${res1.success.length} out of ${res1.size} songs`.green.bold)
		}
		if (res1.error.length != 0) {
			console.log(`There was a problem while downloading these ${res1.error.length} songs:`.red)
			for (var item1 of res1.error) {
				console.log(item1.name)
			}
		}
		if (res1.success.length == 0 && res1.error.length == 0) {
			console.log(`There are no new songs to download in: '${playlist}'`.yellow)
		}
	} catch (err) {
		console.error(err)
	}
}


async function saveWholeQueue(folder) {
	try {
		var product = {
			success: [],
			error: []
		};
		for (var i = queue.length - 1; i >= 0; i--) {
			queue[i].name = convertToCorrectFileName(queue[i].name);
			if (await checkIfFileExists(queue[i], folder) && playlistData[folder].notFullyDownloaded != queue[i].id) {
				queue.splice(i, 1);
			}
		}
		product.size = queue.length;
		while (queue[0]) {
			playlistData[folder].notFullyDownloaded = queue[0].id;
			savePlaylistData();
			const res = await download(queue[0], folder, product.size - queue.length + 1, product.size);
			delete playlistData[folder].notFullyDownloaded;
			clearPreviousLine(2);
			savePlaylistData();
			if (res.error) {
				product.error.push(queue[0]);
			} else if (res.success) {
				product.success.push(queue[0]);
			}
			queue.shift();
		}
		return product;
	} catch (err) {
		console.error(err)
	}
}

async function download(item, folder, pos = 1, num = 1) {
	try {
		console.log(`Downloading: ${item.name}... [ ${pos} / ${num} ]`.cyan)
		const res = await streamFile(item, folder, pos, num);
		savePlaylistData();
		return res;
	} catch (err) {
		clearPreviousLine();
		const res2 = await download(item, folder, pos, num);
		return res2;
	}
}

async function streamFile(item, folder) {
	try {
		return new Promise((resolve, reject) => {
			let a = ytdl(item.id, { filter: "audioonly"});
			let b = fs.createWriteStream(`${path}${folder}/${item.name}.mp3`);
			a.pipe(b);
			b.on('finish', () => {
				resolve({
					success: true,
					name: item.name
				});
			});
			a.on('error', () => reject({
				success: false,
				name: item.name
			}));
			let startTime;
			a.once('response', () => {
				console.log("Easter Egg".strikethrough);
				// startTime = Date.now();
			});
			a.on('progress', (chunkLength, downloaded, total) => {
				const percent = downloaded / total;
				// const downloadedMinutes = (Date.now() - startTime) / 1000 / 60;
				// readline.cursorTo(process.stdout, 0);
				// process.stdout.write(`${(percent * 100).toFixed(2)}% downloaded`);
				// process.stdout.write(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)\n`);
				// process.stdout.write(`running for: ${downloadedMinutes.toFixed(2)}minutes`);
				// process.stdout.write(`, estimated time left: ${(downloadedMinutes / percent - downloadedMinutes).toFixed(2)}minutes`);
				// readline.moveCursor(process.stdout, 0, -1);

				clearPreviousLine();
				console.log(`${Math.round(percent * 100)}% downloaded`.cyan);
			});
		});
	} catch (err) {
		console.error(err)
	}
}

function clearPreviousLine(n = 1) {
	try {
		while (n-- > 0) {
			readline.moveCursor(process.stdout, -200, -1);
			readline.clearScreenDown(process.stdout);
		}
	} catch (err) {
		console.error(err)
	}
}

async function deleteDirectory(folder) {
	try {
		fs.readdirSync(path + folder).forEach(async (file) => {
			await fs.unlinkSync(`${path}${folder}/${file}`);
		});
		await fs.rmdirSync(path + folder);
	} catch (err) {
		console.error(err)
	}
}

async function checkIfFileExists(item, folder) {
	return await fs.existsSync(`${path}${folder}/${item.name}.mp3`);
}

async function savePlaylistData() {
	await fs.writeFileSync("playlist-data.json", JSON.stringify(playlistData), function(str) {});
}

function convertToCorrectFileName(str) {
	return str.replace(/[\\\/\:\*\?\<\>\|\"]/g, '').replace(/\s+/g, ' ').replace(/([^\s])-([^\s])/g, '$1 - $2');
}

function showHelp() {
	console.log("List of commands:".bold)
	console.log("list".cyan + " - lists all of your saved playlists")
	console.log("download {youtube-video-link}".cyan + " - downloads a single youtube video (*.mp3)")
	console.log("init {directory-name} {youtube-playlist-link}".cyan + " - initialises a directory for a new playlist")
	console.log("update {directory-name | $all}".cyan + " - downloads all new songs added to associated playlist")
	console.log("help".cyan + " - displays this list of available commands")
}