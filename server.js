const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // WordPress aur PC App dono ko connect karne ki permission
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Naya user connect hua: ' + socket.id);

  // Jab website visitor message bhejega
  socket.on('visitor_message', (data) => {
    io.emit('to_admin', data); // Admin (PC App) ko forward karo
  });

  // Jab Admin (Aap) PC App se reply karenge
  socket.on('admin_message', (data) => {
    io.emit('to_visitor', data); // Website visitor ko forward karo
  });

  socket.on('disconnect', () => {
    console.log('User disconnect ho gaya');
  });
});

const listener = server.listen(process.env.PORT, function() {
  console.log('Server is running on port ' + listener.address().port);
});
