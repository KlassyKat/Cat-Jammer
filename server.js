const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fetch = require('node-fetch');

exports.createServer = () => {
    app.use(express.static(`${__dirname}/cat-jam-loop`));

    app.get('/', (req, res) => {
        res.sendFile(`${__dirname}/browserCapture.html`);
    });

    http.listen(4578, () => {
        console.log('Listening on 4578');
        return 'Listening on 4578';
    });
}


//https://www.epidemicsound.com/json/search/tracks/?order=desc&page=1&sort=relevance&term=star-cluster

exports.getSong = (title, platform, artist = null) => {
    let data = {};
    switch(platform) {
        case 'epidemic-sound':
            let search = title.replace(/ /g, '-');

            fetch(`https://www.epidemicsound.com/json/search/tracks/?order=desc&page=1&sort=relevance&term=${search}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(res => res.json())
            .then(json => {
                let tracks = json.entities.tracks;
                for(let track in tracks) {
                    track = tracks[track];
                    if(track.title == title) {
                        data = {
                            title: track.title,
                            artist: track.creatives.mainArtists[0].name,
                            bpm: track.bpm,
                        }
                        io.emit('song', data);
                        break;
                    }
                }
            });
            break;
        case 'youtube':
            data = {
                title: title,
                artist: null,
                bpm: null
            }
            io.emit('song', data);
            break;
        case 'soundcloud':
            data = {
                title: title,
                artist: artist,
                bpm: null
            }
            io.emit('song', data);
            break;
    }
}

exports.jamSpeed = (delay) => {
    io.emit('jam-interval', delay);
}

exports.endJam = () => {
    io.emit('song-over');
}

