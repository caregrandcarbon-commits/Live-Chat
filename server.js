const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');

// MongoDB Connection 
const mongoURI = "mongodb+srv://caregrandcarbon_db_user:xcfP0dKyMVjSEnEX@cluster0.ir1aanu.mongodb.net/GrandCarbonDB?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB Connected successfully!'))
    .catch(err => console.log('MongoDB connection error:', err));

// Database Schemas
const VisitorSchema = new mongoose.Schema({ type: { type: String, default: 'total_visitors' }, count: { type: Number, default: 0 }});
const Visitor = mongoose.model('Visitor', VisitorSchema);

const ChatLogSchema = new mongoose.Schema({
    visitorId: String, name: String, mobile: String, email: String, product: String, location: String,
    history: [{ sender: String, text: String, time: { type: Date, default: Date.now } }],
    createdAt: { type: Date, default: Date.now }
});
const ChatLog = mongoose.model('ChatLog', ChatLogSchema);

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

io.on('connection', (socket) => {
  let clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  if (clientIp && clientIp.includes(',')) clientIp = clientIp.split(',')[0];
  
  let userLocation = { location: "Fetching...", countryCode: "" };
  if (clientIp) {
      axios.get(`http://ip-api.com/json/${clientIp}`).then(response => {
          if (response.data.status === 'success') {
              userLocation.location = `${response.data.city}, ${response.data.regionName} (${response.data.country})`;
              userLocation.countryCode = response.data.countryCode.toLowerCase();
          } else { userLocation.location = "Location Not Found"; }
      }).catch(err => { userLocation.location = "Unknown Location"; });
  }

  // 1. Visitor Tracking (Runs on page load)
  socket.on('page_view', async () => {
      try {
          let doc = await Visitor.findOne({ type: 'total_visitors' });
          if (!doc) doc = new Visitor({ type: 'total_visitors', count: 0 });
          doc.count += 1;
          await doc.save();
          io.emit('update_analytics', { totalVisitors: doc.count }); 
      } catch(e) { console.log(e); }
  });

  // 2. Chat Log Actions (Saves user inputs 24x7)
  socket.on('chat_action', async (data) => {
      try {
          let log = await ChatLog.findOne({ visitorId: data.id });
          if(!log) log = new ChatLog({ visitorId: data.id, location: userLocation.location });
          
          if(data.details) {
              if(data.details.name) log.name = data.details.name;
              if(data.details.mobile) log.mobile = data.details.mobile;
              if(data.details.email) log.email = data.details.email;
              if(data.details.product) log.product = data.details.product;
          }
          if(data.action) log.history.push({ sender: 'system', text: data.action });
          await log.save();
      } catch(e) { console.log(e); }
  });

  // 3. Normal Chat Forwarding
  socket.on('visitor_message', async (data) => {
    data.details.location = userLocation.location;
    data.details.countryCode = userLocation.countryCode;
    io.emit('to_admin', data); 
  });

  socket.on('admin_message', (data) => { io.emit('to_visitor', data); });

  // 4. Send Data to Admin PC on load
  socket.on('get_analytics', async () => {
      try {
          let vis = await Visitor.findOne({ type: 'total_visitors' });
          socket.emit('update_analytics', { totalVisitors: vis ? vis.count : 0 });
      } catch(e) {}
  });

  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, function() { console.log('Server is running on port ' + PORT); });
