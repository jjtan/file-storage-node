var express = require('express');
var config = require('./config');
var fs = require('fs');
var redis = require('redis');
var crypto = require('crypto');
var url = require('url');
var path = require('path');
var async = require('async');
var Busboy = require('busboy');

var app = express();
var redis_client = redis.createClient();

app.get('/', function (req, res) {
  res.send('Hello World!');
});

function filekeyToPath(filekey) {
  return path.join(config.storage_dir, filekey);
}

app.get('/stat', function (req, res) {
  redis_client.get('sha1:' + req.query.filekey, function(err, reply) {
    if (reply) {
      res.json({
        sha1: reply
      });
    } else {
      res.status(400).end();
    }
  });
});

app.get('/download', function (req, res) {
  var filekey = req.query.filekey;
  if (!filekey) {
    res.status(400).end();
  }

  var file_path = filekeyToPath(filekey);
  var stat = fs.statSync(file_path);
  console.log('Responding with ' + file_path + ' (size: ' + stat.size + ')');

  var head = {
    'Content-Length': stat.size,
    'Content-Type': 'application/octet-stream',
  };

  var redis_key = 'file_name:' + filekey;
  redis_client.get(redis_key, function(err, reply) {
    if (reply) {
      head['Content-Disposition'] = 'attachment; filename="' + reply + '"';
    } else {
      console.error('Error while getting redis key ' + redis_key);
    }
  });

  res.writeHead(200, head);

  var d = require('domain').create();
  d.on('error', function (err) {
    console.log("Failed to decrypt");
  });

  d.run(function(){
    var decipher = crypto.createDecipher('aes-256-cbc', 'password');
    fs.createReadStream(file_path).pipe(decipher).pipe(res);
  });
});

app.post('/upload', function (req, res) {
  var filekey = '';
  var bb = new Busboy({ headers: req.headers });
  
  bb.on('file', function(fieldname, file, filename, encoding, mimetype) {
    console.log('busboy: ' + fieldname + ' ' + filename + ' ' + encoding + ' ' + mimetype);
    filekey = crypto.createHash('md5').update(filename + (new Date().getTime()) + req.ip).digest('hex');
    var target_path = filekeyToPath(filekey);
    
    redis_client.set('file_name:' + filekey, target_path);

    console.log('Uploading...');
    var cipher = crypto.createCipher('aes-256-cbc', 'password');
    file.pipe(cipher).pipe(fs.createWriteStream(target_path));

    var hash = crypto.createHash('sha1');
    hash.setEncoding('hex');
    file.on('end', function () {
      hash.end();
      var hash_val = hash.read();
      redis_client.set('sha1:' + filekey, hash_val);

      var download_url = url.parse('http://' + req.hostname + ':' + config.port);
      download_url.pathname = 'download';
      download_url.search = 'filekey=' + filekey;

      res.json({
        url: url.format(download_url),
        sha1: hash_val
      });
    });
    file.pipe(hash);

    console.log('Finished uploading');
  });

  req.pipe(bb);
});


var server = app.listen(config.port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening ta http://%s:%s', host, port);
});

