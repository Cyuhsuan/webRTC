const express = require('express');
const app = express();
const http = require('http');
const socket = require('socket.io');

const server = http.createServer(app).listen('9111');

app.get('/chat', function(req, res) {
    res.sendfile(`${__dirname}/chat.html`);
});

// js 路徑轉換
app.get(/(.*)\.(jpg|gif|png|ico|css|js|txt)/i, function(req, res) {
    console.log(__dirname);
    res.sendfile(`${__dirname}/${req.params[0]}.${req.params[1]}`);
});

const io = socket(server);

io.on('connection', (socket) => {
    console.log('connection');

    // 加入房間
    socket.on('join', (room) => {
        console.log('join');
        socket.join(room);
        socket.to(room).emit('ready', '準備通話');
    });

    // 轉傳 Offer
    socket.on('offer', ({room, description}) => {
        socket.to(room).emit('offer', description);
    });

    // 轉傳 Answer
    socket.on('answer', ({room, description}) => {
        socket.to(room).emit('answer', description);
    });

    // 交換 ice candidate
    socket.on('ice_candidate', ({room, data}) => {
        socket.to(room).emit('ice_candidate', data);
    });

    // 關閉通話
    socket.on('hangup', (room) => {
        console.log('hangup');
        socket.leave(room);
    });
});