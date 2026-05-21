package controllers

import (
	"net/http"
	"strings"
	"sync"

	"unilibra-backend/internal/app/middlewares"
	"unilibra-backend/internal/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type realtimeEvent struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type realtimeClient struct {
	conn   *websocket.Conn
	userID uint
	mu     sync.Mutex
}

type realtimeHub struct {
	mu      sync.RWMutex
	clients map[uint]map[*realtimeClient]struct{}
}

var realtime = &realtimeHub{
	clients: map[uint]map[*realtimeClient]struct{}{},
}

var realtimeUpgrader = websocket.Upgrader{
	CheckOrigin: func(request *http.Request) bool {
		origin := strings.TrimSpace(request.Header.Get("Origin"))
		return origin == "" || middlewares.OriginAllowed(origin)
	},
}

type realtimeInput struct {
	Type     string `json:"type"`
	ThreadID uint   `json:"thread_id"`
	Body     string `json:"body"`
}

func ServeRealtime(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	userID, err := utils.ParseToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token realtime tidak valid."})
		return
	}

	conn, err := realtimeUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &realtimeClient{conn: conn, userID: userID}
	realtime.add(client)
	defer realtime.remove(client)
	defer conn.Close()

	client.write("realtime.ready", gin.H{"user_id": userID})

	for {
		var input realtimeInput
		if err := conn.ReadJSON(&input); err != nil {
			return
		}

		if input.Type != "chat.send" || input.ThreadID == 0 {
			continue
		}

		message, recipientID, err := saveChatMessage(userID, input.ThreadID, input.Body)
		if err != nil {
			client.write("chat.error", gin.H{"message": err.Error()})
			continue
		}

		realtime.broadcast(userID, "chat.message", message)
		realtime.broadcast(recipientID, "chat.message", message)
	}
}

func (hub *realtimeHub) add(client *realtimeClient) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if hub.clients[client.userID] == nil {
		hub.clients[client.userID] = map[*realtimeClient]struct{}{}
	}
	hub.clients[client.userID][client] = struct{}{}
}

func (hub *realtimeHub) remove(client *realtimeClient) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	delete(hub.clients[client.userID], client)
	if len(hub.clients[client.userID]) == 0 {
		delete(hub.clients, client.userID)
	}
}

func (hub *realtimeHub) broadcast(userID uint, eventType string, payload interface{}) {
	hub.mu.RLock()
	clients := make([]*realtimeClient, 0, len(hub.clients[userID]))
	for client := range hub.clients[userID] {
		clients = append(clients, client)
	}
	hub.mu.RUnlock()

	for _, client := range clients {
		client.write(eventType, payload)
	}
}

func (client *realtimeClient) write(eventType string, payload interface{}) {
	client.mu.Lock()
	defer client.mu.Unlock()
	_ = client.conn.WriteJSON(realtimeEvent{Type: eventType, Payload: payload})
}
