var express = require('express');
var config = require('./config');
var fs = require('fs');
var redis = require('redis');
var crypto = require('crypto');
var url = require('url');
var path = require('path');
var async = require('async');
var formidable = require('formidable');
var app = express();

var redis_client;
if (process.env.REDIS_URL) {
  var redis_url = url.parse(process.env.REDIS_URL);
  redis_client = redis.createClient(redis_url.port, redis_url.hostname);
  redis_client.auth(redis_url.auth.split(":")[1]);
} else {
  redis_client = redis.createClient();
}

app.get('/', function (req, res) {
  res.send('Hi, you can go to /upload_form.html, /stat, /upload, /download!');
});

function filekeyToPath(filekey) {
  return path.join(config.storage_dir, filekey);
}

function passwordHash(password) {
  return crypto.createHash('sha1').update(password).digest('hex'); // update and digest should be updated
}

app.get('/stat', function (req, res) {
  redis_client.hgetall('filekey:' + req.query.filekey, function(err, reply) {
    if (reply) {
      res.json({
        sha1: reply.sha1
      });
    } else {
      res.status(400).end();
    }
  });
});

app.get('/download', function (req, res) {
  var filekey = req.query.filekey;
  var provided_password = req.query.password;
  if (!filekey || !provided_password) {
    res.status(400).end();
  } else {
    redis_client.hgetall('filekey:' + filekey, function(err, fk) {
      if (!fk) {
        res.status(410).end(); // resource gone
      } else if (passwordHash(provided_password) != fk.password_hash) {
        res.status(401).end(); // unauthorized
      } else {
        var head = {
          'Content-Disposition': 'attachment; filename="' + fk.file_name + '"',
          'Content-Type': fk.file_type
        };

        var d = require('domain').create();
        d.on('error', function (err) {
          console.log("Failed to read file or decrypt: " + err);
          res.status(410).end(); // resource gone
        });

        d.run(function(){
          res.writeHead(200, head); // success!
          var decipher = crypto.createDecipher('aes-256-cbc', provided_password);
          fs.createReadStream(filekeyToPath(filekey)).pipe(decipher).pipe(res);
        });
      }
    });
  }
});

app.post('/upload', function (req, res) {
  var form = new formidable.IncomingForm();

  form.parse(req, function (err, fields, files) {
    console.log('Form received');
    async.waterfall([
        function (cb) {
          if (fields.password) {
            cb(null, fields.password);
          } else {
            cb('No password field', null);
          }
        },
        function (password, cb) {
          async.map(files, function (file) {
            console.log('File received: ' + file.name + ' (' + file.type + ') ' + ' at ' + file.path);
            var filekey = crypto.createHash('md5').update(file.name + (new Date().getTime()) + req.ip).digest('hex');

            var target_path = filekeyToPath(filekey);
            var tmp_file = fs.createReadStream(file.path);

            // generate hash
            var hash = crypto.createHash('sha1');
            hash.setEncoding('hex');
            tmp_file.on('end', function () {
              hash.end();
              var hash_val = hash.read();
              redis_client.hmset('filekey:' + filekey, {
                'sha1': hash_val,
                'file_name': file.name,
                'password_hash': passwordHash(password),
                'file_type': file.type
              });
              redis_client.expire('filekey:' + filekey, 60 * 60 * 24); // expire key in a day
            });
            tmp_file.pipe(hash);

            // encrypt file - may finish after response
            var cipher = crypto.createCipher('aes-256-cbc', password);
            file_to_encrypt = fs.createReadStream(file.path);
            file_to_encrypt.on('end', function() {
              fs.unlink(file.path);
              cb(null, filekey);
            });
            file_to_encrypt.pipe(cipher).pipe(fs.createWriteStream(target_path));
          });
        }
    ],
    function (err, filekey) {
      var download_url = url.parse('http://' + req.hostname + ':' + config.port);
      download_url.pathname = 'download';
      download_url.search = 'filekey=' + filekey + '&password=[password]';
      res.status(201).json({
        url: url.format(download_url),
        filekey: filekey
      });
    });
  });
});

app.use(express.static('./public'));

var server = app.listen(config.port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('File sharing service listening at http://%s:%s', host, port);
});

