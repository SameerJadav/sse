import "./lite-yt-embed.js";

async function init() {
	/** @typedef {{action: "play" | "pause", time: number}} Message */

	const protocol = window.location.protocol === "https:" ? "wss" : "ws";
	const conn = new WebSocket(
		`${protocol}://${window.location.host}/ws/${window.location.pathname.split("/").at(-1)}`,
	);

	const player = await document.querySelector("lite-youtube").getYTPlayer();
	player.seekTo(0, true);
	player.pauseVideo();

	/** @type {number | undefined} prevTime */
	let prevTime = undefined;

	/** @param {Message} msg */
	function send(msg) {
		conn.send(JSON.stringify(msg));
	}

	player.addEventListener("onStateChange", (e) => {
		const time = player.getCurrentTime();

		if (prevTime && Math.abs(prevTime - time) < 1) return;

		switch (e.data) {
			case 1:
				send({ action: "play", time });
				break;
			case 2:
				send({ action: "pause", time });
				break;
		}
	});

	conn.addEventListener("message", (e) => {
		/** @type {Message} msg */
		const msg = JSON.parse(e.data);

		prevTime = msg.time;

		switch (msg.action) {
			case "play":
				player.seekTo(msg.time, true);
				player.playVideo();
				break;
			case "pause":
				player.seekTo(msg.time, true);
				player.pauseVideo();
				break;
		}
	});

	conn.addEventListener("error", (e) => {
		console.log("websocket error:", e);
	});
}

init().catch(console.error);
