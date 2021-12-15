import got from 'got';
import EventEmitter from 'events';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import { got_options } from '../config.js'

const Event = new EventEmitter();

const options = got_options;


// Note that `options` is a plain object, therefore it needs to be passed as the second argument.
(async () => {
  let body = await got.get('https://www.g-portal.com/de/serviceIds', options).json();
  Event.emit('make-server-array', body);
})().catch(e => {
  console.log(e.code); // Deal with the fact the chain failed
});


Event.on('make-server-array', (servers) => {
  let serverIds = new Array()
  servers.forEach(element => {
    serverIds.push(element.serverId);
  });
  Event.emit('get-server-infos', serverIds);
  Event.emit('get-ftp-settings', serverIds);
});


Event.on('get-server-infos', async (serverIds) => {
  let serverDataArray = new Array();
  let index = 0;
  serverIds.forEach(async (element) => {
    got.get('https://api.g-portal.com/gameserver/query/' + element, options).json().then((data) => {
      data.id = element;
      data.name = extractServerName(data.name);
      serverDataArray.push(data);
      index++;
      if (serverIds.length <= index) {
        // console.log(serverDataArray);
      }
    })
  })
});

Event.on('get-ftp-settings', async (serverIds) => {
  let ftpDataArray = new Array();
  let index = 0;
  serverIds.forEach(async (element) => {
    got.get('https://www.g-portal.com/eur/server/ark-se/' + element, options).then((data) => {
      const $ = cheerio.load(data.body);
      let tempObject = {};
      $('.key-value').children('strong').each((i, v) => {
        if ($(v).html().includes('href')) {
          if (i == 0) {
            // Set FTP ip
            tempObject.ip = $(v).text();
          }
        } else {
          switch (i) {
            case 1:
              // Set FTP port
              tempObject.port = $(v).text();
              break;
            case 2:
              // Set FTP username
              tempObject.user = $(v).text();
              break;
            case 3:
              // Set FTP password
              tempObject.password = $(v).text();
              break;
            default:
              break;
          }
        }
      });
      tempObject.name = $('.server__name').text();
      tempObject.id = element
      ftpDataArray.push(tempObject)
      index++;
      if (serverIds.length <= index) {
        // console.log(ftpDataArray);
        writeSearchConfigFile(ftpDataArray);
      }
    })
  })
});

function extractServerName(fullname) {
  return fullname.split(':')[1].split('[')[0].trim().replace(/ /g, '');
}

function writeSearchConfigFile(data) {
  let content = '#!/bin/bash\n\
declare -a server_name\n\
declare -a server_user\n\
declare -a server_pw\n\
declare -a server_ip\n\
declare -a server_port\n\
\n\
export server_name=(\n';

  // Server Name
  data.forEach((element) => {
    content = content + '  ' + extractServerName(element.name) + '\n';
  });
  content = content + ')\n\n';
  content = content + 'export server_user=(\n';
  // Username
  data.forEach((element) => {
    content = content + '  ' + element.user + '\n';
  });
  content = content + ')\n\n';
  content = content + 'export server_pw=(\n';
  // Password
  data.forEach((element) => {
    content = content + '  ' + element.password + '\n';
  });
  content = content + ')\n\n';
  content = content + 'export server_ip=(\n';
  // IP
  data.forEach((element) => {
    content = content + '  ' + element.ip + '\n';
  });
  content = content + ')\n\n';
  content = content + 'export server_port=(\n';
  // Port
  data.forEach((element) => {
    content = content + '  ' + element.port + '\n';
  });
  content = content + ')';

  fs.writeFile('search_config.sh', content, function (err) {
    if (err) return console.log(err);
  });
}