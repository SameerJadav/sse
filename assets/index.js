/** @type {HTMLButtonElement | null} */
const createRoomButton = document.getElementById("create-room-button");
/** @type {HTMLInputElement | null} */
const URLInput = document.getElementById("youtube-video-url");

URLInput.addEventListener("input", () => {
	createRoomButton.disabled = URLInput.value.trim() === "";
});

createRoomButton.addEventListener("click", async (e) => {
	try {
		e.preventDefault();

		const videoURL = URLInput.value.trim();
		if (videoURL === "") {
			throw new Error("youtube video url not found");
		}

		const res = await fetch("/rooms", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ videoURL }),
		});

		if (res.ok) {
			/** @type {{pathname: string}} data */
			const data = await res.json();
			window.location.href = data.pathname;
		} else {
			throw new Error("failed to create room");
		}

		URLInput.value = "";
		createRoomButton.disabled = true;
	} catch (error) {
		console.error(error);
	}
});
