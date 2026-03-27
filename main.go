package main

import (
	"embed"

	"digital-logbook-wails-app/backend"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	backend.Run(assets)
}
