type actions = "play" | "pause" | "sync";

type Message = {
  action: actions;
  time: number;
};
