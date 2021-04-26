'use strict'

const {
    app,
    BrowserWindow,
    BrowserView,
    Tray,
    Menu,
    MenuItem,
    ipcMain,
    globalShortcut,
    session
} = require('electron');

const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');

let Store = require('electron-store');
let store = new Store();
const pie = require("puppeteer-in-electron");
const puppeteer = require('puppeteer-core');

const localServer = require('./server.js');

const windowStateKeeper = require('electron-window-state');

let mainWindow;
let view;
let mainWindowState;

let iconPath = `${__dirname}/build-resources/logo.ico`;

let tray = null;

app.on('ready', () => {
    mainWindowState = windowStateKeeper({
        defaultWidth: 800,
        defaultHeight: 500
    });

    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        minWidth: 440,
        height: mainWindowState.height,
        minHeight: 500,
        frame: false,
        backgroundColor: '#111111',
        icon: iconPath
    });

    mainWindow.loadFile(`${__dirname}/main.html`);
    view = new BrowserView();
    mainWindow.setBrowserView(view);

    view.setBounds({
        x: 0,
        y: 32,
        width: mainWindowState.width,
        height: mainWindowState.height - 32
    });
    changePlatform(store.get('settings.platform'));
    view.webContents.backgroundThrottling = false;
    view.webContents.insertCSS(`
        ::-webkit-scrollbar {
            width: 15px;
        }
        ::-webkit-scrollbar-track {
        background: #1a1a1a; 
        }
        ::-webkit-scrollbar-thumb {
        background: #555; 
        }
        ::-webkit-scrollbar-thumb:hover {
        background: #444;
        }
        body {
            overflow-x: hidden;
        }
    `);
    

    view.webContents.on('did-navigate', (e, url) => {
        console.log(url);
        view.webContents.insertCSS(`
            ::-webkit-scrollbar {
                width: 15px;
            }
            ::-webkit-scrollbar-track {
            background: #1a1a1a; 
            }
            ::-webkit-scrollbar-thumb {
            background: #555; 
            }
            ::-webkit-scrollbar-thumb:hover {
            background: #444;
            }
            body {
                overflow-x: hidden;
            }
        `);
    });

    view.webContents.on('media-started-playing', () => {
        getSongTitle();
    });

    view.webContents.on('media-paused', () => {
        localServer.endJam();
    })

    let rightClick = new Menu();
    let rightClickPos = null;
    rightClick.append(new MenuItem({
        label: "Inspect Element",
        click() {
            view.webContents.inspectElement(rightClickPos.x, rightClickPos.y);
        }
    }));

    view.webContents.on('context-menu', (e, data) => {
        rightClickPos = {x: data.x, y: data.y};
        rightClick.popup({x: rightClickPos.x, y: rightClickPos.y});
    })

    mainWindow.on('closed', () => {
        app.quit();
    });

    ipcMain.on('minimize-main', () => {
        mainWindow.minimize();
    });
    ipcMain.on('maximize-main', () => {
        if(mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('close-main', () => {
        mainWindow.close();
    });

    mainWindow.on('maximize', () => {
        let newBounds = mainWindow.getBounds();
        newBounds.width = newBounds.width - 16;
        newBounds.height = newBounds.height - 16;
        view.setBounds({
          x: 0,
          y: 32,
          width: newBounds.width,
          height: newBounds.height - 32
        })
    })
    mainWindow.on('resized', () => {
    let newBounds = mainWindow.getBounds();
    view.setBounds({
        x: 0,
        y: 32,
        width: newBounds.width,
        height: newBounds.height - 32
    })
    })

    mainWindowState.manage(mainWindow);

    tray = new Tray(iconPath);
    let template = [
        {
            label: 'Open',
            click: () => mainWindow.show()
        },
        {
            type: "separator"
        },
        {
            label: 'Quit',
            click: () => {
                mainWindow.destory();
                app.quit();
            }
        }
    ];

    let trayMenu = Menu.buildFromTemplate(template);
    tray.setContextMenu(trayMenu);
    tray.setToolTip("Cat Jammer");

    app.server = localServer.createServer();
    // view.webContents.openDevTools();

    registerShortcuts();
});
let settingsWindow = null;
ipcMain.on('open-settings', () => {
    settingsWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            spellcheck: false
        },
        frame: false,
        backgroundColor: '#333333',
        width: 400,
        height: 600,
        resizable: false,
        x: mainWindowState.x + (mainWindowState.width/2),
        y: mainWindowState.y + (mainWindowState.height/2),
        // modal: true,
        parent: mainWindow
    });

    settingsWindow.loadFile(`${__dirname}/settings.html`);

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    })
});
ipcMain.on('close-settings', () => {
    settingsWindow.close();
});

ipcMain.on('new-settings', (e, data) => {
    console.log(data);
    setSettings(data);
})

ipcMain.on('get-settings', () => {
    sendSettings();
});

function sendSettings() {
    let settings = store.get('settings') ? store.get('settings') : 
    {
        shortcuts: {}
    };
    settingsWindow.webContents.send('send-settings', settings);
}

function setSettings(data) {
    let oldPlatform = store.get('settings.platform') ? store.get('settings.platform') : 'epidemic-sound';
    store.set('settings', data);
    registerShortcuts();
    console.log(store.get('settings.platform'));
    console.log(oldPlatform);
    if(store.get('settings.platform') && store.get('settings.platform') != oldPlatform) {
        changePlatform(store.get('settings.platform'));
    }
}

function changePlatform(platform) {
    switch(platform) {
        case 'epidemic-sounds':
            view.webContents.loadURL('https://www.epidemicsound.com');
            break;
        case 'youtube':
            view.webContents.loadURL('https://www.youtube.com');
            break;
        case 'soundcloud':
            view.webContents.loadURL('https://soundcloud.com');
            break;
        default:
            view.webContents.loadURL('https://www.epidemicsound.com');
            break;
    }

    ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then(blocker => {
        blocker.enableBlockingInSession(session.defaultSession);
    });
}

class GlobalShortcut {
    constructor(name, shortcut, action) {
        this.name = name;
        this.shortcut = shortcut.map(key => {
            if(key == 'Ctrl' || key == 'Cmd') {
                return 'CommandOrControl';
            }
            return key;
        }).join('+');
        this.action = action;
    }

    register() {
        try {
            globalShortcut.register(this.shortcut, this.action);
        } catch(err) {
            store.set(`settings.shortcuts.${this.name}`, []);
            sendSettings();
        }
    }
}
let gloablShortcuts = {};
function registerShortcuts() {
    console.log('we are at least getting here ?');
    let shortcuts = [
        {
            name: 'playpause',
            shortcut: store.get('settings.shortcuts.playpause'),
            action: toggleMusic
        },
        {
            name: 'skipsong',
            shortcut: store.get('settings.shortcuts.skipsong'),
            action: skipSong
        },
        {
            name: 'volup',
            shortcut: store.get('settings.shortcuts.volup'),
            action: volumeUp
        },
        {
            name: 'voldown',
            shortcut: store.get('settings.shortcuts.voldown'),
            action: volumeDown
        },
        {
            name: 'jam',
            shortcut: store.get('settings.shortcuts.jam'),
            action: jamSpeed
        },
    ];

    globalShortcut.unregisterAll();
    for(let item of shortcuts) {
        let { name, shortcut, action } = item;
        if(shortcut?.length > 0) {
            gloablShortcuts[name] = new GlobalShortcut(name, shortcut, action);
            gloablShortcuts[name].register();
        }
    }
}

let browser;
launchPuppeteer();
async function launchPuppeteer() {
    await pie.initialize(app);
    browser = await pie.connect(app, puppeteer);
}

async function toggleMusic() {
    let platform = store.get('settings.platform') ? store.get('settings.platform') : 'epidemic-sound';
    let page = null;
    switch(platform) {
        case 'epidemic-sound':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }

            if(page) {
                let playBtn = await page.$("a[title=Play]");
                let pauseBtn = await page.$("a[title=Pause]");
                if(playBtn) {
                    playBtn.click();
                } else if(pauseBtn) {
                    pauseBtn.click();
                } else {
                    console.log("I can\'t senpai >-<");
                }
            }
            break;
        case 'youtube':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }

            if(page) {
                await page.keyboard.press('KeyK');
            }
            break;
        case 'soundcloud':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }

            if(page) {
                await page.keyboard.press('Space');
            }
            break;
    }
    
}

async function skipSong() {
    console.log('skip');
    let platform = store.get('settings.platform') ? store.get('settings.platform') : 'epidemic-sound';
    let page = null;
    switch(platform) {
        case 'epidemic-sound':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                let skipBtn = await page.$("a[title=Next]");
                if(skipBtn) {
                    skipBtn.click();
                } else {
                    console.log("I can\'t senpai >-<");
                }
            }
            break; 
        case 'youtube':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                await page.keyboard.down('Shift');
                await page.keyboard.press('KeyN');
                await page.keyboard.up('Shift');
            }
            break;
        case 'soundcloud':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                await page.keyboard.down("Shift");
                await page.keyboard.press("ArrowRight");
                await page.keyboard.up("Shift");
            }
            break; 
    }
    
}
async function volumeUp() {
    console.log('up');
    let page = null;
    let platform = store.get('settings.platform') ? store.get('settings.platform') : 'epidemic-sound';
    switch(platform) {
        case 'epidemic-sound':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                let volTrack = await page.$(".rc-slider-step");
                volTrack = await volTrack.boundingBox();
                let volPos = await page.$(".rc-slider-handle");
                volPos = await volPos.boundingBox();
                if(volTrack && volPos) {
                    let mouseX = (volPos.x + volPos.width) + (volTrack.width / 20);
                    let mouseY = volTrack.y;
                    page.mouse.click(mouseX, mouseY);
                } else {
                    console.log("No find volume (ᗒᗣᗕ)");
                }
            }
            break;
        case 'youtube':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                let videoPlayer = await page.$(".video-stream");
                videoPlayer.focus();
                let slider = await page.$(".ytp-volume-slider");
                await slider.focus();
                await page.keyboard.press("ArrowUp");
                await videoPlayer.focus();
            }
            break;
        case 'soundcloud':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                await page.keyboard.down("Shift");
                await page.keyboard.press("ArrowUp");
                await page.keyboard.up("Shift");
            }
            break;
    }
}
async function volumeDown() {
    let platform = store.get('settings.platform') ? store.get('settings.platform') : 'epidemic-sound';
    let page = null;
    switch(platform) {
        case 'epidemic-sound':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                let volTrack = await page.$(".rc-slider-step");
                volTrack = await volTrack.boundingBox();
                let volPos = await page.$(".rc-slider-handle");
                volPos = await volPos.boundingBox();
                if(volTrack && volPos) {
                    let mouseX = (volPos.x) - (volTrack.width / 20);
                    let mouseY = volTrack.y;
                    page.mouse.click(mouseX, mouseY);
                } else {
                    console.log("No find volume (ᗒᗣᗕ)");
                }
            }
            break;
        case 'youtube':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                let videoPlayer = await page.$(".video-stream");
                videoPlayer.focus();
                let slider = await page.$(".ytp-volume-slider");
                await slider.focus();
                await page.keyboard.press("ArrowDown");
                await videoPlayer.focus();
            }
            break;
        case 'soundcloud':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                await page.keyboard.down("Shift");
                await page.keyboard.press("ArrowDown");
                await page.keyboard.up("Shift");
            }
            break;
    }
}
function jamSpeed() {
    let currentTime = Date.now();
    localServer.jamSpeed(currentTime);
}

let songTitle = '';
async function getSongTitle() {
    let platform = store.get('settings.platform') ? store.get('settings.platform') : 'epidemic-sound';
    let page = null;
    switch(platform) {
        case 'epidemic-sound':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                let trackEl = await page.$('.src-mainapp-player-components-___TrackInfo__title___1NuSH');
                let trackName = await trackEl.evaluate(node => node.innerText);
                if(trackName == songTitle) {
                    return;
                }
                songTitle = trackName;
                localServer.getSong(songTitle, platform);
            }
            break;
        case 'youtube':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                let trackEl = await page.$('h1 > .ytd-video-primary-info-renderer');
                let trackName = await trackEl.evaluate(node => node.innerText);
                if(trackName == songTitle) {
                    return;
                }
                songTitle = trackName;
                localServer.getSong(songTitle, platform);
            }
            break;
        case 'soundcloud':
            try {
                page = await pie.getPage(browser, view);
            } catch(err) {
                console.log(err);
                console.log('senpai baka >-<');
            }
        
            if(page) {
                let trackEl = await page.$('a.playbackSoundBadge__titleLink span:last-child');
                let trackName = await trackEl.evaluate(node => node.innerText);
                if(trackName == songTitle) {
                    return;
                }
                let artistEl = await page.$('playbackSoundBadge__lightLink');
                let artist = artistEl.evaluate(node => node.innerText);
                songTitle = trackName;
                localServer.getSong(songTitle, platform, artist);
            }
            break;
    }
}