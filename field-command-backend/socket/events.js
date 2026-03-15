const Rep = require("../models/Rep");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌  Socket connected: ${socket.id}`);

    // Rep joins their personal room (so managers can send targeted notifications)
    socket.on("rep:join", (repId) => {
      socket.join(`rep:${repId}`);
      console.log(`👤  Rep ${repId} joined their room`);
    });

    // Manager joins manager room
    socket.on("manager:join", () => {
      socket.join("managers");
      console.log(`🧑‍💼  Manager joined managers room`);
    });

    // Rep sends a live location ping
    socket.on("rep:ping", async ({ repId, lat, lng, battery }) => {
      try {
        await Rep.findByIdAndUpdate(repId, { location: { lat, lng }, battery });
        // Broadcast to all managers
        io.to("managers").emit("rep:location", { repId, lat, lng, battery });
      } catch (err) {
        console.error("rep:ping error:", err.message);
      }
    });

    // Rep reports idle time (sent periodically from frontend)
    socket.on("rep:idle_tick", async ({ repId, idleMinutes }) => {
      try {
        await Rep.findByIdAndUpdate(repId, { idleMinutes });
        io.to("managers").emit("rep:idle_update", { repId, idleMinutes });
      } catch (err) {
        console.error("rep:idle_tick error:", err.message);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌  Socket disconnected: ${socket.id}`);
    });
  });
};

