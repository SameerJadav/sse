import "./lite-yt-embed.js";

async function main() {
  /** @type {YT.Player} */
  const player = await document.querySelector("lite-youtube").getYTPlayer();

  if (!player) {
    console.error("Player not found");
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const id = window.location.pathname.split("/").at(-1);
  const conn = new WebSocket(`${protocol}://${window.location.host}/ws/${id}`);

  /** @param {Message} msg  */
  function send(msg) {
    conn.send(JSON.stringify(msg));
    console.log("Sent message:", msg);
  }

  /** @type {actions | undefined} */
  let expectedAction = undefined;

  conn.addEventListener("open", () => {
    console.log("WebSocket connection established");
    player.pauseVideo();
    player.seekTo(0, true);
    send({ action: "sync", time: 0 });
    expectedAction = "play";
  });

  conn.addEventListener("error", (e) => {
    console.error("WebSocket error:", e);
  });

  conn.addEventListener("message", (e) => {
    try {
      /** @type {Message} */
      const msg = JSON.parse(e.data);
      console.log("Received message:", msg);

      if (msg.action === expectedAction || msg.action === "sync") {
        switch (msg.action) {
          case "play":
            player.seekTo(msg.time, true);
            player.playVideo();
            expectedAction = "pause";
            break;
          case "pause":
            player.pauseVideo();
            player.seekTo(msg.time, true);
            expectedAction = "play";
            break;
          case "sync":
            player.pauseVideo();
            player.seekTo(0, true);
            expectedAction = "play";
            break;
        }
      } else {
        console.log(
          `Ignoring unexpected action: ${msg.action}, expected: ${expectedAction}`,
        );
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  player.addEventListener("onStateChange", (e) => {
    switch (e.data) {
      case 1:
        if (expectedAction === "play") {
          send({ action: "play", time: player.getCurrentTime() });
          expectedAction = "pause";
        }
        break;
      case 2:
        if (expectedAction === "pause") {
          send({ action: "pause", time: player.getCurrentTime() });
          expectedAction = "play";
        }
        break;
    }
  });
}

main().catch((error) => {
  console.error("Top level error:", error);
});
