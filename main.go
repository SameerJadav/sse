package main

import (
	"embed"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

//go:embed assets
var assets embed.FS

//go:embed templates/room.html
var roomTmpl embed.FS

type Template struct {
	templates *template.Template
}

func (t *Template) Render(w io.Writer, name string, data interface{}, c echo.Context) error {
	return t.templates.ExecuteTemplate(w, name, data)
}

var upgrader = websocket.Upgrader{}

type Room struct {
	Id      string
	Members [2]*websocket.Conn
}

var rooms = make(map[string]*Room)

func main() {
	e := echo.New()

	tmpl, err := template.ParseFS(roomTmpl, "templates/room.html")
	if err != nil {
		log.Fatal(err)
	}

	e.Renderer = &Template{
		templates: tmpl,
	}

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	e.GET("/*", echo.WrapHandler(func() http.Handler {
		fsys, err := fs.Sub(assets, "assets")
		if err != nil {
			panic(err)
		}
		return http.FileServerFS(fsys)
	}()))

	e.POST("/rooms", func(c echo.Context) error {
		req := c.Request()

		ct := req.Header.Get("Content-Type")
		if ct != "application/json" {
			return echo.NewHTTPError(http.StatusUnsupportedMediaType)
		}

		var body struct {
			VideoURL string `json:"videoURL"`
		}
		if err := c.Bind(&body); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "request body is incorrect")
		}

		var start, end int
		for i := len(body.VideoURL) - 1; i >= 0; i-- {
			char := body.VideoURL[i]
			if char == '?' {
				end = i
			} else if char == '/' {
				start = i + 1
				break
			}
		}

		videoID := body.VideoURL[start:end]
		if videoID == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "video URL is incorrect")
		}

		id := uuid.NewString()

		res := map[string]string{"pathname": fmt.Sprintf("/rooms/%s?videoid=%s", id, videoID)}

		return c.JSON(http.StatusOK, res)
	})

	e.GET("/rooms/:id", func(c echo.Context) error {
		id := c.Param("id")
		if id == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "room ID not found")
		} else if _, err := uuid.Parse(id); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "room ID is not a valid UUID")
		}

		if room, ok := rooms[id]; ok {
			if room.Members[0] != nil && room.Members[1] != nil {
				return echo.NewHTTPError(http.StatusBadRequest, "room is full")
			} else {
				data := struct{ VideoID string }{VideoID: c.QueryParam("videoid")}
				return c.Render(http.StatusOK, "room.html", data)
			}
		} else {
			rooms[id] = &Room{Id: id}
			data := struct{ VideoID string }{VideoID: c.QueryParam("videoid")}
			return c.Render(http.StatusOK, "room.html", data)
		}
	})

	e.GET("/ws/:id", func(c echo.Context) error {
		id := c.Param("id")
		if id == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "room ID not found")
		} else if _, err := uuid.Parse(id); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "room ID is not a valid UUID")
		}

		room, ok := rooms[id]
		if !ok {
			return echo.NewHTTPError(http.StatusInternalServerError, "room does not exist")
		}

		conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to upgrade connection")
		}

		var memberIdx uint8
		if room.Members[0] == nil {
			room.Members[0] = conn
		} else {
			room.Members[1] = conn
			memberIdx = 1
		}

		defer func() {
			conn.Close()
			room.Members[memberIdx] = nil
			if room.Members[0] == nil && room.Members[1] == nil {
				delete(rooms, id)
			}
		}()

		for {
			msgType, msg, err := conn.ReadMessage()
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to read the message")
			}

			for _, member := range room.Members {
				if member != nil && member != conn {
					if err := member.WriteMessage(msgType, msg); err != nil {
						return echo.NewHTTPError(http.StatusInternalServerError, "failed to write the message")
					}
				}
			}
		}
	})

	e.Logger.Fatal(e.Start(fmt.Sprintf(":%s", os.Getenv("PORT"))))
}
