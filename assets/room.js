import "./lite-yt-embed.js";

async function main() {
  /** @type {YT.Player} */
  const player = await document.querySelector("lite-youtube").getYTPlayer();

  if (!player) {
    console.error("Player not found");
  }

  /** @type {WebSocket | null} */
  let conn = null;

  /**
   * @param {WebSocket} conn
   * @param {Message} msg */
  function send(conn, msg) {
    if (conn.readyState === WebSocket.OPEN) {
      conn.send(JSON.stringify(msg));
      console.log("Sent message:", msg);
    } else {
      console.error("Cannot send message - WebSocket not open");
    }
  }

  /** @type {actions | undefined} */
  let expectedAction = undefined;

  let currentReconnectDelay = 1000;
  const maxReconnectDelay = 16000;

  function connect() {
    if (conn) {
      conn.close();
      conn = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const id = window.location.pathname.split("/").at(-1);
    conn = new WebSocket(`${protocol}://${window.location.host}/ws/${id}`);

    conn.addEventListener("open", () => {
      currentReconnectDelay = 1000;
      console.log("WebSocket connection established");
      player.pauseVideo();
      const time = player.getCurrentTime();
      player.seekTo(time, true);
      send(conn, { action: "sync", time });
      expectedAction = "play";
    });

    conn.addEventListener("close", () => {
      conn = null;
      setTimeout(
        () => {
          if (currentReconnectDelay < maxReconnectDelay) {
            currentReconnectDelay *= 2;
          }
          connect();
        },
        currentReconnectDelay + Math.floor(Math.random() * 3000),
      );
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
              player.seekTo(msg.time, true);
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

    conn.addEventListener("error", (e) => {
      console.error("WebSocket error:", e);
    });
  }

  player.addEventListener("onStateChange", (e) => {
    if (!conn || conn.readyState !== WebSocket.OPEN) return;

    switch (e.data) {
      case 1:
        if (expectedAction === "play") {
          send(conn, { action: "play", time: player.getCurrentTime() });
          expectedAction = "pause";
        }
        break;
      case 2:
        if (expectedAction === "pause") {
          send(conn, { action: "pause", time: player.getCurrentTime() });
          expectedAction = "play";
        }
        break;
    }
  });

  connect();
}

main().catch((error) => {
  console.error("Top level error:", error);
});
