var express = require('express');
var config = require('./config');
var fs = require('fs');
var multiparty = require('multiparty');
var redis = require('redis');
var crypto = require('crypto');
var url = require('url');
var path = require('path');

var app = express();
var redis_client = redis.createClient();

app.get('/', function (req, res) {
  res.send('Hello World!');
});

function filekeyToPath(filekey) {
  return path.join(config.storage_dir, filekey);
}

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

  var is = fs.createReadStream(file_path);
  is.pipe(res);
});

app.post('/upload', function (req, res) {
  var form = new multiparty.Form();
  var filekey = '';

  form.on('part', function (part) {
    if (!part.filename) {
      part.resume();
    } else {
      console.log('file_name: ' + part.filename);
    }
  });

  form.on('close', function() {
    res.json({
      complete: 'ok'
    });
  });

  //form.on('file', function(name, file) {
  //  var tmp_path = file.path;
  //  filekey = crypto.createHash('md5').update(file.originalFilename + (new Date().getTime()) + req.ip).digest('hex');
  //  console.log('File key created: ' + filekey);
  //  var target_path = filekeyToPath(filekey);

  //  console.log('Moving ' + tmp_path + ' to ' + target_path + '...');
  //  redis_client.set('file_name:' + filekey, file.originalFilename);
  //  var is = fs.createReadStream(tmp_path);
  //  var os = fs.createWriteStream(target_path);
  //  is.pipe(os);
  //  is.on('end', function() {
  //    fs.unlinkSync(tmp_path);
  //  });
  //});

  //form.on('close', function() {
  //  console.log('Upload complete! ' + filekey);
  //  res.set('Content-Type', 'text/plain');
  //  var download_url = url.parse('http://' + req.hostname + ':' + config.port);
  //  download_url.pathname = 'download';
  //  download_url.search = 'filekey=' + filekey;
  //  console.log('download_url: ' + url.format(download_url));

  //  console.log('Generating sha1 of ' + filekeyToPath(filekey));
  //  var target_file = filekeyToPath(filekey);
  //  console.log('target: ' + target_file);
  //  console.log('target size: ' + fs.statSync(target_file).size);
  //  var is = fs.createReadStream(target_file);
  //  var hash = crypto.createHash('sha1');
  //  hash.setEncoding('hex');
  //  //var out = '';
  //  //is.on('data', function (d) {
  //  //  console.log('data: ' + d);
  //  //  out += d.read().toString();
  //  //});
  //  is.on('end', function() {
  //    //hash.write("\n");
  //    hash.end();
  //    res.json({
  //      url: url.format(download_url),
  //      sha1: hash.read()
  //    });
  //  });
  //  is.pipe(hash);
  //});

  form.parse(req);
});


var server = app.listen(config.port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening ta http://%s:%s', host, port);
});

