const express = require('express');
const WebSocket = require('ws');
const CryptoJS = require('crypto-js');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));

const server = app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});

const wss = new WebSocket.Server({ server });

// Хранение подключенных пиров
const peers = new Map();

wss.on('connection', (ws) => {
    const peerId = generatePeerId();
    peers.set(peerId, ws);

    // Отправляем ID новому пиру
    ws.send(JSON.stringify({
        type: 'init',
        peerId: peerId
    }));

    // Отправляем список всех пиров новому подключению
    const peerList = Array.from(peers.keys());
    ws.send(JSON.stringify({
        type: 'peers',
        peers: peerList
    }));

    // Оповещаем других пиров о новом подключении
    broadcast(JSON.stringify({
        type: 'newPeer',
        peerId: peerId
    }), ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'message':
                    // Шифруем сообщение перед отправкой
                    const encryptedMessage = encryptMessage(data.message);
                    
                    // Отправляем сообщение в соответствующий чат
                    if (data.chat === 'general') {
                        // В общий чат отправляем всем
                        broadcast(JSON.stringify({
                            type: 'message',
                            from: peerId,
                            message: encryptedMessage,
                            chat: 'general',
                            timestamp: data.timestamp
                        }));
                    } else {
                        // В личный чат отправляем только получателю
                        const recipient = peers.get(data.chat);
                        if (recipient) {
                            recipient.send(JSON.stringify({
                                type: 'message',
                                from: peerId,
                                message: encryptedMessage,
                                chat: data.chat,
                                timestamp: data.timestamp
                            }));
                        }
                        // Отправляем копию отправителю
                        ws.send(JSON.stringify({
                            type: 'message',
                            from: peerId,
                            message: encryptedMessage,
                            chat: data.chat,
                            timestamp: data.timestamp
                        }));
                    }
                    break;
                case 'requestPeers':
                    ws.send(JSON.stringify({
                        type: 'peers',
                        peers: Array.from(peers.keys())
                    }));
                    break;
            }
        } catch (error) {
            console.error('Ошибка обработки сообщения:', error);
        }
    });

    ws.on('close', () => {
        peers.delete(peerId);
        broadcast(JSON.stringify({
            type: 'peerLeft',
            peerId: peerId
        }));
    });
});

function broadcast(message, exclude = null) {
    peers.forEach((peer, id) => {
        if (peer !== exclude && peer.readyState === WebSocket.OPEN) {
            peer.send(message);
        }
    });
}

function generatePeerId() {
    return CryptoJS.SHA256(Date.now().toString()).toString().substring(0, 8);
}

function encryptMessage(message) {
    const key = CryptoJS.lib.WordArray.random(256/8);
    const iv = CryptoJS.lib.WordArray.random(128/8);
    const encrypted = CryptoJS.AES.encrypt(message, key, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
    });
    return {
        message: encrypted.toString(),
        key: key.toString(),
        iv: iv.toString()
    };
} 