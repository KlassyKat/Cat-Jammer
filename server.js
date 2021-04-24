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

exports.getSong = (title) => {
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
                let data = {
                    title: track.title,
                    artist: track.creatives.mainArtists[0].name,
                    bpm: track.bpm,
                }
                io.emit('song', data);
                break;
            }
        }
    })
}

exports.jamSpeed = (delay) => {
    io.emit('jam-interval', delay);
}

