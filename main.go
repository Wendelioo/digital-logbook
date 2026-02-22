package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Load app settings (kiosk mode, etc.)
	appConfig := LoadAppSettings()

	// Window start state - fullscreen in kiosk mode, normal otherwise
	startState := options.Normal
	if appConfig.KioskMode {
		startState = options.Fullscreen
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:            "Digital Logbook",
		Width:            1000,
		Height:           700,
		MinWidth:         800,
		MinHeight:        600,
		DisableResize:    false,
		Fullscreen:       appConfig.KioskMode,
		Frameless:        false,
		AlwaysOnTop:      appConfig.KioskMode,
		StartHidden:      false,
		WindowStartState: startState,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 248, G: 250, B: 252, A: 1},
		OnStartup:        app.startup,
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			if app.screenLocked {
				// When screen is locked (user not logged in), prevent closing
				log.Println("Screen locked: Window close attempt blocked - user must login first")
				return true
			}
			// When user is logged in, also prevent closing (they should logout properly)
			if app.kioskMode {
				log.Println("Kiosk mode: Please logout through the app")
				return true
			}
			return false
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		log.Fatal("Error:", err.Error())
	}
}
