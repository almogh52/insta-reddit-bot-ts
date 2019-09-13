import { IgApiClient } from "instagram-private-api";
import inquirer from "inquirer";
import Jimp from "jimp";
import snoowrap from "snoowrap";

const igUsername = "rddimemes";
const igPassword = "RedditMemes123";

const ig = new IgApiClient();

const r = new snoowrap({
	userAgent: "posix:com.almoghamdani.instabot:v1.0.0 (by /u/almogh52)",
	clientId: "3Ih7MLWXCRIzrg",
	clientSecret: "SfdheBFKkVybn9ZwE3tWgSqkSSo",
	refreshToken: "65194045-infRn9AHuJHxYaakOnHBerrdQp0"
});

const subreddits = ["memes", "dankmemes", "me_irl", "dank_meme"];

var subredditCache = new Object({
	memes: new Array<String>(),
	dankmemes: new Array<String>(),
	me_irl: new Array<String>(),
	dank_meme: new Array<String>()
});

// Generate device
ig.state.generateDevice(igUsername);

async function fitImageToAspecRatio(img: string): Promise<Buffer> {
	const image = await Jimp.read(img);
	const newImageSize = Math.max(image.bitmap.height, image.bitmap.width);

	// Contain the image in a 4:3 image
	image.contain(newImageSize, newImageSize);

	// Convert to buffer
	var buf;
	await image.getBuffer(Jimp.MIME_JPEG, (_, b) => {
		buf = b;
	});

	return buf;
}

async function getNewPosts(): Promise<Array<snoowrap.Submission>> {
	var newPosts = new Array<snoowrap.Submission>();

	for await (const subreddit of subreddits) {
		console.log("Fetching Subreddit r/" + subreddit + "..");

		// Get 5 last hot posts
		const hotPosts = await r.getSubreddit(subreddit).getHot({
			count: 5
		});

		for (const submission of hotPosts) {
			// If the submission isn't used yet, add it to the list of posts
			if (!subredditCache[subreddit].includes(submission.id)) {
				subredditCache[subreddit].push(submission.id);
				newPosts.push(submission);
			}
		}
	}

	return newPosts;
}

async function uploadPosts() {
	console.log("Fetching Posts..");
	const newPosts = (await getNewPosts()).sort(() => Math.random() - 0.5);

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

				console.log("Uploaded submission " + newPost.id);
			} catch (ex) {
				console.log(
					"An error occurred during the upload of the submission " +
						newPost.id +
						". The error was: " +
						ex
				);
			}
		}
	}
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

	uploadPosts();
	setInterval(uploadPosts, 1800000);
})();
