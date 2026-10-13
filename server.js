const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios'); // API call ke liye

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Naya user connect hua: ' + socket.id);

  // Client ka IP address nikalna (Render proxy bypass karke)
  let clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  if (clientIp && clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0]; 
  }

  // Server-side IP API call (Ad blockers ise block nahi kar sakte)
  let userLocation = { location: "Fetching...", countryCode: "" };
  
  if (clientIp) {
      axios.get(`http://ip-api.com/json/${clientIp}`)
          .then(response => {
              const data = response.data;
              if (data.status === 'success') {
                  userLocation.location = `${data.city}, ${data.regionName} (${data.country})`;
                  userLocation.countryCode = data.countryCode.toLowerCase();
              } else {
                  userLocation.location = "Location Not Found";
              }
          })
          .catch(err => {
              console.log("IP Fetch Error on Server:", err.message);
              userLocation.location = "Unknown Location";
          });
  }

  socket.on('visitor_message', (data) => {
    // Inject server-fetched location into visitor's data
    data.details.location = userLocation.location;
    data.details.countryCode = userLocation.countryCode;
    
    io.emit('to_admin', data); 
  });

  socket.on('admin_message', (data) => {
    io.emit('to_visitor', data); 
  });

  socket.on('disconnect', () => {
    console.log('User disconnect ho gaya');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
  console.log('Server is running on port ' + PORT);
});
