const spawn = require('await-spawn');
const fs = require('fs');
const axios = require('axios').default;
const ip = require("ip");
const FormData = require('form-data');
const utils = require('../utils');
const config = require('../config');
const Foscam = require('foscam-client');

const BASE_ADDRESS = 'http://52.91.135.65';
const PORT = '5000';
const BASE_URL = `${BASE_ADDRESS}:${PORT}/api/`;


const cameraUsername = 'pi-admin';
const cameraPassword = '123456@';
const port = 88;

// socket
const io = require("socket.io-client");
initSocket();


cameras = [];

module.exports.handleMultipleCameras = async (macs) => {

    for (let mac of macs) {
        try {
            let data = await getSanpshot(mac, '', true);
        } catch (e) {
            console.log('could not get snapshot for camera ' + mac);
            return null;
        }
    }
};


module.exports.netScan = async function () {
    console.time();
    await Promise.all([loop(1, 50),/* loop(50, 100),*//* loop(100, 150), loop(150, 255)*/]);
    console.timeEnd();
    console.log(cameras.length + ' cameras were found!');

    // let res = await axios.post(BASE_URL + 'studio/', cameras);
    try {
        let res = await axios.post(BASE_URL + 'studio/' + config.STUDIO_ID + '/connected-cameras', {'cameras': cameras});
        console.log(cameras.length + ' cameras were uploaded to server');
    } catch (e) {
        console.error('could not upload cameras to server', e);
    }
};

async function loop(start, count) {

    const fullIp = ip.address();
    let lastIndex = fullIp.lastIndexOf('.');
    let ipPrefix = fullIp.substring(0, lastIndex);

    for (let i = start; i < start + count; ++i) {
        let ip = ipPrefix + '.' + i;
        let foscam = new Foscam({
            username: cameraUsername,
            password: cameraPassword,
            host: ip,
            port: port,
            protocol: 'http',
            rejectUnauthorizedCerts: true
        });

        try {

            let info = await utils.runWithTimeLimit(115, foscam.getDevInfo());
            if (info == null) {
                //  console.log('could not find camera on address: ' + ip);
                continue;
            }

            console.log('foscam ip cam was found on ip ' + ip + '  ' + info.mac);
            cameras.push({
                ip: ip,
                mac: info.mac.toString(),
                name: info.devName,
            });
        } catch (e) {
            //  console.error('could not get info for ip ' + ip, e);
        }
    }
}

module.exports.getSnapshotSync = async () => {
    let path = '/Users/idan/Downloads/ffmpeg/ffmpeg';
    let cmd = '-y -rtsp_transport tcp -i rtsp://10.100.102.41:554/live/ch1 -f image2 -vf fps=fps=1 img.png';
    //  ffmpeg -y -rtsp_transport tcp -i rtsp://10.100.102.41:554/live/ch1 -f image2 -vf fps=fps=1 img.png

    let args = [
        '-y',
        '-rtsp_transport', 'tcp',
        // '-frames:v', '1',
        '-i', cameraUrl,
        '-f', 'image2',
        '-vf',
        'fps=fps=1',
        'image.jpg'
    ];

    try {

        let proc = spawn(path, args);

        proc.stdout.on('data', function (data) {
            console.log(data);
        });

        proc.stderr.setEncoding("utf8");
        proc.stderr.on('data', function (data) {
            console.log(data);
        });

        proc.on('close', function () {
            console.log('finished');
            return true;
        });


    } catch (e) {
        console.log(e.stderr);
        return false;
    }
};

module.exports.getSnapshot = async (filename) => {
    let path = '/Users/idan/Downloads/ffmpeg/ffmpeg';
    let cmd = '-y -rtsp_transport tcp -i rtsp://10.100.102.41:554/live/ch1 -f image2 -vf fps=fps=1 img.png';
    //  ffmpeg -y -rtsp_transport tcp -i rtsp://10.100.102.41:554/live/ch1 -f image2 -vf fps=fps=1 img.png

    let args = [
        '-y',
        '-rtsp_transport', 'tcp',
        '-i', cameraUrl,
        '-f', 'image2',
        '-vf',
        'fps=fps=1',
        filename
    ];

    try {
        const proc = await spawn(path, args);
        console.log(proc);
        return true;
    } catch (e) {
        console.log(e.stderr);
    }

    if (fs.existsSync('./' + filename)) {
        console.log('exists');
        return true;
    }

    return false;
};

function initSocket() {
    const socket = io(`${BASE_ADDRESS}:${PORT}`);

    socket.on('connect', () => {
        // console.log('socket connected', socket);
        socket.emit('setStudioId', {studioId: config.STUDIO_ID});
    });


    socket.on('TakeSnapshot', async (data) => {
        const macs = data.cameras;
        const barcode = data.barcode;
        console.log('take snapshot request for ' + macs.length + ' cameras');
        for (let i = 0; i < macs.length; ++i) {
            setTimeout(() => {
                getSanpshot(macs[i], barcode, true);
            }, i * 350);
        }

        // await Promise.all([macs.map(mac => getSanpshot(mac, barcode, true))]);

        /* for (let mac of macs) {
             try {
                 await getSanpshot(mac, barcode, true);
             } catch (e) {
                 console.log('could not get snapshot for camera ' + mac);
                 return null;
             }
         }*/
    });

    socket.on('netScan', async (data) => {
        const macs = data.cameras;
    });

}

async function getSanpshot(mac, barcode, upload = true) {
    try {

        // get camera ip
        let camera = cameras.find(c => c.mac === mac);
        if (!camera) return null;

        let foscam = new Foscam({
            username: cameraUsername,
            password: cameraPassword,
            host: camera.ip,
            port: port, // default
            protocol: 'http', // default
            rejectUnauthorizedCerts: true // default
        });
        let data = await foscam.snapPicture2();
        if (upload) {
            await uploadImage(barcode, data, mac);
        }
        return data;

    } catch (e) {
        return null;

    }
}

async function uploadImage(barcode, image, mac) {
    let data = new FormData();

    // const filePath = __dirname + `/../images/${barcode}_${new Date().getTime()}.jpg`;
    // await fs.writeFile(filePath, image, "binary", (e) => console.log(e));

    // data.append('image', fs.createReadStream(filePath));
    data.append('image', image, {filename: 'image.jpg'});
    data.append('barcode', barcode);
    data.append('studioId', config.STUDIO_ID);
    data.append('macAddress', mac);

    let httpConfig = {
        method: 'post',
        url: BASE_URL + 'product/images',
        headers: {
            ...data.getHeaders()
        },
        data: data
    };

    try {
        let res = await axios(httpConfig);
        console.log('image uploaded')
    } catch (e) {
        console.error('could not upload image', e.stack);
    }
    /*  .then(function (response) {
          // console.log(JSON.stringify(response.data));
          console.log('image uploaded');
      })
      .catch(function (error) {
          // console.log(error);
          console.log('could not upload file');
      });
*/

    /* data.append('image', image, 'image');
     data.append('barcode', barcode);
     data.append('studioId', config.STUDIO_ID);
     let res = await axios.post(BASE_URL + 'product/images', data);
     console.log('upload image response', res.data);*/
}


