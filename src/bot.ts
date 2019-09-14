import { IgApiClient } from "instagram-private-api";
import inquirer from "inquirer";
import Jimp from "jimp";
import snoowrap from "snoowrap";

const igUsername = process.env.IG_USERNAME;
const igPassword = process.env.IG_PASSWORD;

const ig = new IgApiClient();

const r = new snoowrap({
	userAgent: "posix:com.almoghamdani.instabot:v1.0.0 (by /u/almogh52)",
	clientId: "3Ih7MLWXCRIzrg",
	clientSecret: "SfdheBFKkVybn9ZwE3tWgSqkSSo",
	refreshToken: "65194045-infRn9AHuJHxYaakOnHBerrdQp0"
});

const subreddits = ["memes", "dankmemes", "me_irl", "dank_meme"];

var submissionCache = new Array<String>();

var postsQueue = new Array<snoowrap.Submission>();

// Generate device
ig.state.generateDevice(igUsername);

async function fitImageToAspecRatio(img: string): Promise<Buffer> {
	const image = await Jimp.read(img);
	const newImageSize = Math.max(image.bitmap.height, image.bitmap.width);

	// Contain the image in a 4:3 image
	image.contain(newImageSize, newImageSize);

	// Convert to buffer
	var buf;
	await image.rgba(false).background(0xFFFFFFFF).getBuffer(Jimp.MIME_JPEG, (_, b) => {
		buf = b;
	});

	return buf;
}

async function fetchNewPosts() {
	var newPosts = new Array<snoowrap.Submission>();

	console.log("Fetching Posts..");

	for await (const subreddit of subreddits) {
		console.log("Fetching Subreddit r/" + subreddit + "..");

		// Get hot posts
		var hotPosts = await r.getSubreddit(subreddit).getHot();

		// Remove all used submissions
		var hotPostsList = hotPosts.filter(
			submission => !submissionCache.includes(submission.id)
		);

		// Sort the submissions by their upvotes
		hotPostsList = hotPostsList.sort((a, b) => (a.ups > b.ups ? -1 : 1));

		// Take only the top 3
		hotPostsList = hotPostsList.splice(0, 3);

		// Add all new submissions to the new posts array
		newPosts = newPosts.concat(hotPostsList);
	}

	// Shuffle the new posts
	newPosts.sort(() => Math.random() - 0.5);

	// Save all the new posts to the submission cache
	submissionCache = submissionCache.concat(newPosts.map(post => post.id));

	// Add the new submissions to the queue
	postsQueue = postsQueue.concat(newPosts);
}

async function uploadPosts() {
	let newPosts;

	try {
		newPosts = [postsQueue.shift(), postsQueue.shift()];
	} catch {
		console.log("Unable to get new posts to upload..");
		return;
	}

	// For each new post, upload it
	console.log("Starting to upload..");
	for (const newPost of newPosts) {
		if (newPost.url && !newPost.is_video && !newPost.selftext) {
			try {
				await ig.publish.photo({
					file: await fitImageToAspecRatio(newPost.url),
					caption:
						(newPost.title ? newPost.title + " " : "") +
						"(" +
						newPost.subreddit_name_prefixed +
						")"
				});

				console.log(
					"[" +
						(newPosts.indexOf(newPost) + 1) +
						"/" +
						newPosts.length +
						"] Uploaded submission " +
						newPost.id
				);
			} catch (ex) {
				console.log(
					"An error occurred during the upload of the submission " +
						newPost.id +
						". The error was: " +
						ex
				);
			}
		} else {
			console.log(
				"[" +
					(newPosts.indexOf(newPost) + 1) +
					"/" +
					newPosts.length +
					"] Ignoring submission " +
					newPost.id
			);
		}
	}

	console.log("Finished Uploading Posts..");
}

function cleanCache() {
	submissionCache = new Array<String>();
}

(async () => {
	// Execute all requests prior to authorization in the real Android application
	// Not required but recommended
	await ig.simulate.preLoginFlow();
	const user = await ig.account.login(igUsername, igPassword);

	// Trying to get the feed to check for challange
	await ig.feed
		.user(user.pk)
		.items()
		.catch(async () => {
			console.log(ig.state.checkpoint); // Checkpoint info here
			await ig.challenge.auto(true); // Requesting sms-code or click "It was me" button
			console.log(ig.state.challenge); // Challenge info here
			const { code } = await inquirer.prompt([
				{
					type: "input",
					name: "code",
					message: "Enter code"
				}
			]);
			console.log(await ig.challenge.sendSecurityCode(code));
		});

	// The same as preLoginFlow()
	// Optionally wrap it to process.nextTick so we dont need to wait ending of this bunch of requests
	process.nextTick(async () => await ig.simulate.postLoginFlow());

	console.log("Authenticated Successfully!");

	await fitImageToAspecRatio("http://www.eagledroneimaging.com/images/flag_colors_sky_noeagle%201200x200.jpg")

	setInterval(fetchNewPosts, 3540000); // Fetch new posts every 59 minutes
	setInterval(uploadPosts, 600000); // Upload new posts every 10 minutes
	setInterval(cleanCache, 172440000); // Clean the cache every 2 days
	await fetchNewPosts();
	await uploadPosts();
})();
