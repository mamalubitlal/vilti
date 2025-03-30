let peerId = generatePeerId();
let connections = new Map();
let currentChat = 'general';
let userName = `Пользователь${Math.floor(Math.random() * 1000)}`;

// Эмодзи для выбора
const emojis = ['😊', '😂', '😍', '😭', '😅', '😆', '😉', '😋', '😎', '😡', '😢', '😤', '😨', '😩', '😫', '😴', '😌', '😏', '😒', '😓'];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userName').textContent = userName;
    document.getElementById('peerId').value = peerId;
    initializeWebRTC();
});

function generatePeerId() {
    return Math.random().toString(36).substring(2, 15);
}

function initializeWebRTC() {
    // Создаем RTCPeerConnection для каждого подключения
    window.peer = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });

    // Обработка входящих соединений
    peer.ondatachannel = (event) => {
        const channel = event.channel;
        setupDataChannel(channel);
    };

    // Создаем канал данных для отправки сообщений
    const dataChannel = peer.createDataChannel('chat');
    setupDataChannel(dataChannel);

    // Создаем предложение для подключения
    peer.createOffer()
        .then(offer => peer.setLocalDescription(offer))
        .then(() => {
            // Сохраняем предложение для отправки другим пирам
            window.localOffer = peer.localDescription;
        });
}

function setupDataChannel(channel) {
    channel.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    channel.onopen = () => {
        console.log('Канал данных открыт');
    };
}

function connectToPeer() {
    const connectToId = document.getElementById('connectToId').value;
    if (!connectToId) {
        showNotification('Введите ID для подключения');
        return;
    }

    // Создаем новое соединение
    const connection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });

    // Создаем канал данных
    const dataChannel = connection.createDataChannel('chat');
    setupDataChannel(dataChannel);

    // Сохраняем соединение
    connections.set(connectToId, {
        peer: connection,
        channel: dataChannel
    });

    // Создаем предложение
    connection.createOffer()
        .then(offer => connection.setLocalDescription(offer))
        .then(() => {
            // Отправляем предложение через WebSocket или другой сигнальный сервер
            // В реальном приложении здесь должен быть код для обмена SDP
            showNotification('Подключение установлено');
            updateChatList();
        });
}

function handleMessage(data) {
    switch(data.type) {
        case 'message':
            if (data.chat === currentChat) {
                displayMessage(data.from, decryptMessage(data.message), data.timestamp);
            }
            break;
        case 'peerInfo':
            updatePeerInfo(data.peerId, data.userName);
            break;
    }
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (message) {
        const timestamp = new Date().toLocaleTimeString();
        const encryptedMessage = encryptMessage(message);
        
        // Отправляем сообщение всем подключенным пирам
        connections.forEach((conn, peerId) => {
            if (conn.channel.readyState === 'open') {
                conn.channel.send(JSON.stringify({
                    type: 'message',
                    from: peerId,
                    message: encryptedMessage,
                    chat: currentChat,
                    timestamp: timestamp
                }));
            }
        });

        // Отображаем сообщение локально
        displayMessage(peerId, message, timestamp);
        messageInput.value = '';
    }
}

function displayMessage(from, message, timestamp) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${from === peerId ? 'sent' : 'received'}`;
    
    const messageContent = document.createElement('div');
    messageContent.textContent = message;
    
    const timeElement = document.createElement('div');
    timeElement.className = 'message-time';
    timeElement.textContent = timestamp;
    
    messageElement.appendChild(messageContent);
    messageElement.appendChild(timeElement);
    
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateChatList() {
    const chatListDiv = document.getElementById('chatList');
    chatListDiv.innerHTML = '';
    
    // Добавляем общий чат
    const generalChat = createChatItem('general', 'Общий чат', connections.size + 1);
    chatListDiv.appendChild(generalChat);
    
    // Добавляем личные чаты с каждым пользователем
    connections.forEach((conn, peerId) => {
        const chatItem = createChatItem(peerId, `Пользователь ${peerId}`, 1);
        chatListDiv.appendChild(chatItem);
    });
}

function createChatItem(id, name, participants) {
    const chatItem = document.createElement('div');
    chatItem.className = `chat-item ${id === currentChat ? 'active' : ''}`;
    chatItem.onclick = () => switchChat(id);
    
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = name.charAt(0);
    
    const info = document.createElement('div');
    info.className = 'chat-info';
    
    const chatName = document.createElement('div');
    chatName.className = 'chat-name';
    chatName.textContent = name;
    
    const status = document.createElement('div');
    status.className = 'chat-status';
    status.textContent = `${participants} участников`;
    
    info.appendChild(chatName);
    info.appendChild(status);
    
    chatItem.appendChild(avatar);
    chatItem.appendChild(info);
    
    return chatItem;
}

function switchChat(chatId) {
    currentChat = chatId;
    document.getElementById('messages').innerHTML = '';
    updateChatList();
    
    const chatName = chatId === 'general' ? 'Общий чат' : `Пользователь ${chatId}`;
    document.getElementById('currentChatName').textContent = chatName;
    document.getElementById('currentChatAvatar').textContent = chatName.charAt(0);
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (!picker.classList.contains('active')) {
        picker.innerHTML = '';
        emojis.forEach(emoji => {
            const button = document.createElement('button');
            button.className = 'emoji-button';
            button.textContent = emoji;
            button.onclick = () => insertEmoji(emoji);
            picker.appendChild(button);
        });
        picker.classList.add('active');
    } else {
        picker.classList.remove('active');
    }
}

function insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    input.value += emoji;
    input.focus();
    document.getElementById('emojiPicker').classList.remove('active');
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
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

function decryptMessage(encryptedData) {
    try {
        const key = CryptoJS.enc.Hex.parse(encryptedData.key);
        const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);
        const decrypted = CryptoJS.AES.decrypt(encryptedData.message, key, {
            iv: iv,
            padding: CryptoJS.pad.Pkcs7,
            mode: CryptoJS.mode.CBC
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error('Ошибка расшифровки:', error);
        return '[Ошибка расшифровки]';
    }
}

// Обработка отправки сообщения по Enter
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Закрытие эмодзи пикера при клике вне его
document.addEventListener('click', (e) => {
    const picker = document.getElementById('emojiPicker');
    const button = document.querySelector('.emoji-button');
    if (!picker.contains(e.target) && e.target !== button) {
        picker.classList.remove('active');
    }
}); 